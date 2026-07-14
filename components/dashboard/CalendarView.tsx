'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/Button';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Calendar as CalendarIcon, Plus, ArrowUp, RefreshCw, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useGoogleCalendarTokens } from '@/hooks/useGoogleCalendarTokens';
import { useRouter, useSearchParams } from 'next/navigation';
import { EventModal } from '@/components/calendar/EventModal';
import { EventList, type CalendarListEvent } from '@/components/calendar/EventList';
import { generateRecurringEvents, materializeEventsForUI, resolveRecurrenceEndDate } from '@/lib/calendarUtils';
import { getUserPlanTier } from '@/lib/subscriptionUtils';
import type { CalendarOccurrence, CalendarEventRow } from '@/types/calendarOccurrence';
import { parseOccurrenceId } from '@/types/calendarOccurrence';
import Link from 'next/link';

interface EventFormData {
  title: string;
  description: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  recurrence_type: 'none' | 'weekly' | 'custom';
  selected_days?: string[];
  recurrence_end_date?: string;
}

type EventEditScope = 'single' | 'all' | 'this_and_following';

interface Event {
  id: string;
  google_event_id: string | null;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  project_id: string;
  created_by: string;
  series_id?: string | null;
  is_series_master?: boolean;
  is_exception?: boolean;
  original_start_date?: string | null;
  recurrence_rule: string | null;
  recurrence_days: string[] | null;
  recurrence_end_date: string | null;
  is_recurring: boolean;
  creator?: {
    name: string;
    email: string;
  };
}

interface SyncPayloadEvent {
  id?: string;
  project_id?: string;
  google_event_id?: string | null;
  title: string;
  description: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  is_recurring: boolean;
  recurrence_rule: string | null;
  selected_days?: string[];
  recurrence_end_date?: string;
  timeZone: string;
}

interface SyncSummary {
  created: number;
  updated: number;
  linked: number;
  skipped: number;
  errors: number;
  at: string;
}

const SYNC_BATCH_SIZE = 20;

const isEndBeforeStart = (data: Pick<EventFormData, 'start_date' | 'start_time' | 'end_date' | 'end_time'>) => {
  if (!data.start_date || !data.start_time || !data.end_date || !data.end_time) {
    return false;
  }

  const start = new Date(`${data.start_date}T${data.start_time}:00`);
  const end = new Date(`${data.end_date}T${data.end_time}:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  return end < start;
};

const toSyncPayloadEvent = (event: Event, userTimeZone: string): SyncPayloadEvent => {
  const startParts = event.start_date.includes('T')
    ? event.start_date.split('T')
    : [event.start_date, '00:00:00'];
  const endParts = event.end_date.includes('T')
    ? event.end_date.split('T')
    : [event.end_date, '23:59:00'];
  const recurrenceDays = Array.isArray(event.recurrence_days)
    ? event.recurrence_days.filter((day): day is string => typeof day === 'string')
    : [];

  return {
    id: event.id,
    project_id: event.project_id,
    google_event_id: event.google_event_id,
    title: event.title,
    description: event.description || '',
    start_date: startParts[0],
    start_time: startParts[1].slice(0, 5),
    end_date: endParts[0],
    end_time: endParts[1].slice(0, 5),
    is_recurring: event.is_recurring || false,
    recurrence_rule: event.recurrence_rule,
    selected_days: recurrenceDays,
    recurrence_end_date: event.recurrence_end_date || undefined,
    timeZone: userTimeZone,
  };
};

const pickRecurringSeriesRepresentatives = (events: Event[]) => {
  const nonRecurring = events.filter((event) => !event.is_recurring);
  const recurring = events.filter((event) => event.is_recurring);

  const bySeries = new Map<string, Event[]>();
  for (const event of recurring) {
    const key = event.series_id || event.id;
    const bucket = bySeries.get(key) || [];
    bucket.push(event);
    bySeries.set(key, bucket);
  }

  const recurringRepresentatives: Event[] = [];
  bySeries.forEach((seriesEvents) => {
    const explicitMaster = seriesEvents.find((event) => event.is_series_master);
    if (explicitMaster) {
      recurringRepresentatives.push(explicitMaster);
      return;
    }

    const fallback = [...seriesEvents].sort((a, b) => {
      if (a.start_date === b.start_date) {
        return a.id.localeCompare(b.id);
      }
      return a.start_date.localeCompare(b.start_date);
    })[0];

    if (fallback) recurringRepresentatives.push(fallback);
  });

  return [...nonRecurring, ...recurringRepresentatives].sort((a, b) => {
    if (a.start_date === b.start_date) {
      return a.id.localeCompare(b.id);
    }
    return a.start_date.localeCompare(b.start_date);
  });
};

export const CalendarView: React.FC = () => {
  const supabase = createClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [lastSyncSummary, setLastSyncSummary] = useState<SyncSummary | null>(null);
  const [isProMember, setIsProMember] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingOccurrenceStart, setEditingOccurrenceStart] = useState<string | null>(null);
  const [editScope, setEditScope] = useState<EventEditScope>('single');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const oauthProcessedRef = useRef(false);
  const { user } = useAuthStore();
  const { currentProject } = useProjectStore();
  const normalizedRole = currentProject?.userRole?.toLowerCase();
  const isViewer = normalizedRole === 'viewer';
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    tokens: activeTokens,
    isConnected: activeIsConnected,
    isLoading: isGoogleLoading,
    userEmail: activeUserEmail,
    authMethod,
    isGoogleUser,
    needsReconnect,
    connectGoogleCalendar: connectGoogle,
    disconnectGoogleCalendar: disconnectGoogle,
    processOAuthCallback,
  } = useGoogleCalendarTokens();
  const userTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const canUseGoogleSync = isProMember && !isViewer;

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<EventFormData>({
    defaultValues: {
      recurrence_type: 'none',
      selected_days: [],
    },
  });

  // Detectar scroll para mostrar botón
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        setShowScrollTop(scrollTop > 300);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Manejar callback de Google OAuth (solo una vez)
  useEffect(() => {
    const handleGoogleAuth = async () => {
      // Evitar procesamiento múltiple del mismo callback
      if (oauthProcessedRef.current) return;

      const googleAuthParam = searchParams?.get('google_auth');
      const errorParam = searchParams?.get('error');

      if (!googleAuthParam && !errorParam) return;

      oauthProcessedRef.current = true;

      const result = await processOAuthCallback({
        googleAuthParam,
        errorParam,
        projectId: currentProject?.id,
      });

      if (result.infoMessage) {
        toast.info(result.infoMessage);
      }

      if (result.message) {
        if (result.status === 'error') {
          toast.error(result.message);
        } else if (result.status === 'success') {
          toast.success(result.message);
        }
      }

      if (result.redirectTo) {
        router.replace(result.redirectTo);
      }
    };

    handleGoogleAuth();
  }, [currentProject?.id, processOAuthCallback, router, searchParams]);

  useEffect(() => {
    const loadPlan = async () => {
      if (!user?.id) {
        setIsProMember(false);
        return;
      }

      try {
        const tier = await getUserPlanTier(supabase, user.id);
        setIsProMember(tier === 'pro');
      } catch (error) {
        console.error('Error al cargar plan para Google Calendar:', error);
        setIsProMember(false);
      }
    };

    loadPlan();
  }, [supabase, user?.id]);

  // Conectar con Google Calendar (usando hook unificado)
  const connectGoogleCalendar = async () => {
    if (!isProMember) {
      toast.error('La sincronización con Google Calendar está disponible solo para miembros PRO');
      return;
    }
    if (isViewer) {
      toast.error('Tu rol es Viewer: solo puedes visualizar el calendario');
      return;
    }
    try {
      await connectGoogle(currentProject?.id);
    } catch (error) {
      console.error('Error al conectar con Google Calendar:', error);
      toast.error('Error al conectar con Google Calendar');
    }
  };

  // Desconectar Google Calendar (usando hook unificado)
  const disconnectGoogleCalendar = async () => {
    if (!isProMember) {
      toast.error('La sincronización con Google Calendar está disponible solo para miembros PRO');
      return;
    }
    if (isViewer) {
      toast.error('Tu rol es Viewer: solo puedes visualizar el calendario');
      return;
    }
    try {
      await disconnectGoogle();
      toast.info('Google Calendar desconectado');
    } catch (error) {
      console.error('Error al desconectar:', error);
      toast.error('Error al desconectar Google Calendar');
    }
  };

  // Sincronizar evento con Google Calendar
  const syncEventToGoogle = async (event: SyncPayloadEvent, checkDuplicate = false) => {
    if (!isProMember) {
      return { success: false, skipped: false, googleEventId: null };
    }
    if (!activeTokens) {
      return { success: false, skipped: false };
    }

    try {
      const response = await fetch('/api/google/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokens: activeTokens, event: { ...event, timeZone: userTimeZone }, checkDuplicate }),
      });

      if (!response.ok) {
        throw new Error('Error al sincronizar');
      }

      const data = await response.json();

      return {
        success: true,
        skipped: data.skipped || false,
        action: data.action,
        googleEventId: data.google_event_id || data.data?.id || null,
      };
    } catch (error) {
      console.error('Error al sincronizar con Google:', error);
      return { success: false, skipped: false, googleEventId: null };
    }
  };

  const syncEventsBatchToGoogle = async (eventsBatch: SyncPayloadEvent[], checkDuplicate = false) => {
    if (!isProMember) {
      return {
        created: 0,
        updated: 0,
        linked: 0,
        skipped: 0,
        errors: eventsBatch.length,
      };
    }
    if (!activeTokens) {
      return {
        created: 0,
        updated: 0,
        linked: 0,
        skipped: 0,
        errors: eventsBatch.length,
      };
    }

    try {
      const response = await fetch('/api/google/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens: activeTokens,
          events: eventsBatch,
          checkDuplicate,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al sincronizar lote de eventos');
      }

      const data = await response.json();
      return {
        created: data.created || 0,
        updated: data.updated || 0,
        linked: data.linked || 0,
        skipped: data.skipped || 0,
        errors: data.errors || 0,
      };
    } catch (error) {
      console.error('Error al sincronizar lote con Google:', error);
      return {
        created: 0,
        updated: 0,
        linked: 0,
        skipped: 0,
        errors: eventsBatch.length,
      };
    }
  };

  // Eliminar evento de Google Calendar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deleteEventFromGoogle = async (event: any) => {
    if (!isProMember) {
      return;
    }
    const projectId = event.project_id || currentProject?.id;
    const startDate = typeof event.start_date === 'string'
      ? event.start_date.split('T')[0]
      : '';

    if (!projectId && !activeTokens) {
      return;
    }

    try {
      const response = await fetch('/api/google/sync', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens: activeTokens,
          projectId,
          eventId: event.id,
          googleEventId: event.google_event_id,
          eventTitle: event.title,
          startDate: startDate || event.start_date,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al eliminar de Google');
      }
    } catch (error) {
      console.error('Error al eliminar de Google Calendar:', error);
    }
  };

  // Sincronizar todos los eventos existentes
  const syncAllEventsToGoogle = async () => {
    if (!isProMember) {
      toast.error('La sincronización con Google Calendar está disponible solo para miembros PRO');
      return;
    }
    if (isViewer) {
      toast.error('Tu rol es Viewer: solo puedes visualizar el calendario');
      return;
    }
    if (!activeTokens || !events || events.length === 0) {
      toast.error('No hay eventos para sincronizar');
      return;
    }

    const eventsToSync = pickRecurringSeriesRepresentatives(events as Event[]);

    if (eventsToSync.length === 0) {
      toast.error('No hay eventos para sincronizar');
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: eventsToSync.length });
    const loadingToast = toast.loading(`Sincronizando ${eventsToSync.length} evento(s)...`);
    let createdCount = 0;
    let updatedCount = 0;
    let linkedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
      const payloadEvents = eventsToSync.map((event) => toSyncPayloadEvent(event, userTimeZone));

      for (let index = 0; index < payloadEvents.length; index += SYNC_BATCH_SIZE) {
        const batch = payloadEvents.slice(index, index + SYNC_BATCH_SIZE);
        const result = await syncEventsBatchToGoogle(batch, true);
        createdCount += result.created;
        updatedCount += result.updated;
        linkedCount += result.linked;
        skippedCount += result.skipped;
        errorCount += result.errors;

        setSyncProgress({ current: Math.min(index + SYNC_BATCH_SIZE, payloadEvents.length), total: payloadEvents.length });
      }

      toast.dismiss(loadingToast);
      setLastSyncSummary({
        created: createdCount,
        updated: updatedCount,
        linked: linkedCount,
        skipped: skippedCount,
        errors: errorCount,
        at: new Date().toISOString(),
      });

      const syncedCount = createdCount + updatedCount + linkedCount;
      createdCount = syncedCount;

      if (errorCount === 0 && skippedCount === 0) {
        toast.success(`${syncedCount} evento(s) sincronizado(s) exitosamente`);
      } else if (errorCount === 0) {
        toast.success(`${createdCount} sincronizados, ${skippedCount} ya existían`);
      } else {
        toast.warning(`${createdCount} sincronizados, ${skippedCount} omitidos, ${errorCount} errores`);
      }
    } catch {
      toast.dismiss(loadingToast);
      toast.error('Error al sincronizar eventos');
    } finally {
      setIsSyncing(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  };

  // Fetch events
  const { data: events, isLoading: isEventsLoading } = useQuery({
    queryKey: ['events', currentProject?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select(`
          *,
          creator:users(name, email)
        `)
        .eq('project_id', currentProject!.id)
        .order('start_date', { ascending: true });
      return data || [];
    },
    enabled: !!currentProject?.id,
  });

  // Create event mutation — Option 3: 1 fila master (sin materializar N ocurrencias)
  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      if (isViewer) {
        throw new Error('No tienes permisos para crear eventos');
      }
      if (isEndBeforeStart(data)) {
        throw new Error('La hora de fin no puede ser menor que la hora de inicio');
      }

      const generated = generateRecurringEvents(data);
      if (generated.length === 0) {
        throw new Error('No se pudo generar el evento');
      }

      const first = generated[0];
      const isRecurring = data.recurrence_type !== 'none';
      // El check events_recurring_requires_series_id exige series_id en el INSERT
      const eventId = crypto.randomUUID();
      const recurrenceEndDate = isRecurring
        ? resolveRecurrenceEndDate(data.start_date, data.recurrence_end_date || null)
        : null;

      const { data: createdEvent, error } = await supabase
        .from('events')
        .insert({
          id: eventId,
          project_id: currentProject!.id,
          title: data.title,
          description: data.description,
          start_date: first.start,
          end_date: first.end,
          recurrence_rule: isRecurring ? data.recurrence_type : null,
          is_recurring: isRecurring,
          recurrence_days: isRecurring ? (data.selected_days || []) : null,
          recurrence_end_date: recurrenceEndDate,
          series_id: isRecurring ? eventId : null,
          is_series_master: isRecurring,
          is_exception: false,
          is_cancelled: false,
          original_start_date: first.start,
          created_by: user!.id,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (!createdEvent) throw new Error('No se pudo crear el evento');

      return [createdEvent as Event];
    },
    onSuccess: async (createdEvents, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(
        variables.recurrence_type !== 'none'
          ? 'Serie creada exitosamente'
          : 'Evento creado exitosamente',
      );

      if (canUseGoogleSync && activeIsConnected && activeTokens) {
        const localEvent = createdEvents[0];
        const generatedEvents = generateRecurringEvents(variables);
        const event = generatedEvents[0];
        if (!event || !localEvent) {
          setIsModalOpen(false);
          reset();
          setSelectedDays([]);
          setShowRecurrenceOptions(false);
          return;
        }

        const [startDate, startTime] = event.start.split('T');
        const [endDate, endTimeStr] = event.end.split('T');
        const endTime = endTimeStr.split(':').slice(0, 2).join(':');

        const result = await syncEventToGoogle({
          id: localEvent.id,
          project_id: localEvent.project_id,
          google_event_id: localEvent.google_event_id,
          title: variables.title,
          description: variables.description,
          start_date: startDate,
          start_time: startTime.slice(0, 5),
          end_date: endDate,
          end_time: endTime,
          is_recurring: variables.recurrence_type !== 'none',
          recurrence_rule:
            variables.recurrence_type === 'none' ? null : variables.recurrence_type,
          selected_days:
            variables.recurrence_type !== 'none' ? variables.selected_days : [],
            recurrence_end_date: variables.recurrence_end_date
              ? resolveRecurrenceEndDate(
                  variables.start_date,
                  variables.recurrence_end_date,
                )
              : resolveRecurrenceEndDate(variables.start_date, null),
            timeZone: userTimeZone,
          });

        if (!result.success) {
          toast.warning(
            'El evento se guardó en Veenzo, pero la sincronización con Google falló.',
          );
        }

        queryClient.invalidateQueries({ queryKey: ['events'] });
      }

      setIsModalOpen(false);
      reset();
      setSelectedDays([]);
      setShowRecurrenceOptions(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Error al crear evento');
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({
      event,
      data,
      scope,
    }: {
      event: Event;
      data: EventFormData;
      scope: EventEditScope;
    }) => {
      if (isViewer) {
        throw new Error('No tienes permisos para editar eventos');
      }
      if (!currentProject?.id) {
        throw new Error('No hay proyecto seleccionado');
      }
      if (isEndBeforeStart(data)) {
        throw new Error('La hora de fin no puede ser menor que la hora de inicio');
      }

      const recurrenceRule = data.recurrence_type === 'none'
        ? 'none'
        : data.recurrence_type;

      const response = await fetch('/api/google/sync', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event.id,
          projectId: currentProject.id,
          scope,
          occurrenceStart: editingOccurrenceStart || event.original_start_date || event.start_date,
          applyToGoogle: canUseGoogleSync && activeIsConnected,
          changes: {
            title: data.title,
            description: data.description,
            start_date: data.start_date,
            start_time: data.start_time,
            end_date: data.end_date,
            end_time: data.end_time,
            is_recurring: data.recurrence_type !== 'none',
            recurrence_rule: recurrenceRule,
            recurrence_days: data.recurrence_type !== 'none' ? (data.selected_days || []) : [],
            recurrence_end_date:
              data.recurrence_type !== 'none'
                ? (data.recurrence_end_date || null)
                : null,
            time_zone: userTimeZone,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Error al editar evento');
      }

      return payload;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['events', currentProject?.id] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.refetchQueries({ queryKey: ['events', currentProject?.id] });
      const scopeLabel =
        result.scope === 'all'
          ? 'toda la serie'
          : result.scope === 'this_and_following'
            ? 'este y siguientes'
            : 'solo este evento';

      toast.success(`Evento actualizado (${scopeLabel})`);
      if (result.message) {
        toast.info(result.message);
      } else if (
        result.google?.attempted &&
        (result.google?.updated || 0) +
          (result.google?.created || 0) +
          (result.google?.linked || 0) ===
          0
      ) {
        toast.warning(
          'Se guardó en Veenzo, pero Google Calendar no reflejó el cambio.',
        );
      }

      setIsModalOpen(false);
      setEditingEvent(null);
      setEditingOccurrenceStart(null);
      setEditScope('single');
      reset({
        recurrence_type: 'none',
        selected_days: [],
      });
      setSelectedDays([]);
      setShowRecurrenceOptions(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Error al editar evento');
    },
  });

  const handleEditEvent = (event: CalendarListEvent) => {
    const occurrence = event as CalendarOccurrence;
    const occurrenceStart = occurrence.occurrence_start || event.start_date;

    const wallClockTime = (value: string, fallback: string) => {
      const raw = (value.split('T')[1] || fallback)
        .replace(/\.\d+/, '')
        .replace(/(Z|[+-]\d{2}:?\d{2})$/i, '');
      return raw.slice(0, 5);
    };

    const normalizedEvent: Event = {
      // Conservar id virtual (`master::fecha`) para que el PATCH resuelva la ocurrencia
      id: event.id,
      google_event_id: event.google_event_id || null,
      title: event.title,
      description: event.description || '',
      start_date: event.start_date,
      end_date: event.end_date,
      project_id: event.project_id || currentProject?.id || '',
      created_by: event.created_by || user?.id || '',
      series_id: occurrence.series_id,
      is_series_master: occurrence.is_series_master ?? undefined,
      is_exception: occurrence.is_exception ?? undefined,
      original_start_date: occurrenceStart,
      recurrence_rule: event.recurrence_rule || null,
      recurrence_days: Array.isArray(event.recurrence_days)
        ? event.recurrence_days
        : null,
      recurrence_end_date: event.recurrence_end_date || null,
      is_recurring: event.is_recurring || false,
      creator: event.creator,
    };

    const startDate = event.start_date.split('T')[0] || event.start_date;
    const endDate = event.end_date.split('T')[0] || event.end_date;

    const recurrenceType = normalizedEvent.is_recurring
      ? ((normalizedEvent.recurrence_rule as EventFormData['recurrence_type']) || 'weekly')
      : 'none';

    setEditingEvent(normalizedEvent);
    setEditingOccurrenceStart(occurrenceStart);
    setEditScope('single');
    setSelectedDays(Array.isArray(normalizedEvent.recurrence_days) ? normalizedEvent.recurrence_days : []);
    setShowRecurrenceOptions(normalizedEvent.is_recurring);

    reset({
      title: normalizedEvent.title || '',
      description: normalizedEvent.description || '',
      start_date: startDate,
      start_time: wallClockTime(event.start_date, '00:00:00'),
      end_date: endDate,
      end_time: wallClockTime(event.end_date, '23:59:00'),
      recurrence_type: recurrenceType,
      selected_days: Array.isArray(normalizedEvent.recurrence_days) ? normalizedEvent.recurrence_days : [],
      recurrence_end_date: normalizedEvent.recurrence_end_date || undefined,
    });

    setIsModalOpen(true);
  };
  const closeEventModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setEditingOccurrenceStart(null);
    setEditScope('single');
    setShowRecurrenceOptions(false);
    setSelectedDays([]);
    reset({
      recurrence_type: 'none',
      selected_days: [],
    });
  };

  // Delete: ocurrencia virtual → cancelar excepción; one-off/master → borrar fila
  const deleteEventMutation = useMutation({
    mutationFn: async (occurrenceId: string) => {
      if (isViewer) {
        throw new Error('No tienes permisos para eliminar eventos');
      }

      const parsed = parseOccurrenceId(occurrenceId);
      const sourceId = parsed.sourceEventId;

      const { data: sourceRow, error: findError } = await supabase
        .from('events')
        .select('*')
        .eq('id', sourceId)
        .maybeSingle();

      if (findError) throw findError;
      if (!sourceRow) throw new Error('Evento no encontrado');

      // One-off o borrar master completo (id real sin ::)
      if (!parsed.isVirtual && !sourceRow.is_recurring) {
        const { error } = await supabase.from('events').delete().eq('id', sourceId);
        if (error) throw error;
        return { mode: 'deleted' as const, eventData: sourceRow };
      }

      if (!parsed.isVirtual && sourceRow.is_series_master && !sourceRow.is_exception) {
        // Borrar toda la serie (master + excepciones)
        const seriesId = sourceRow.series_id || sourceRow.id;
        const { data: seriesRows } = await supabase
          .from('events')
          .select('*')
          .eq('series_id', seriesId);

        const { error } = await supabase.from('events').delete().eq('series_id', seriesId);
        if (error) throw error;
        return {
          mode: 'series_deleted' as const,
          eventData: sourceRow,
          seriesRows: seriesRows || [],
        };
      }

      // Cancelar una ocurrencia (virtual o excepción)
      const occurrenceDate =
        parsed.occurrenceDate ||
        (sourceRow.original_start_date || sourceRow.start_date).split('T')[0];
      const masterId = sourceRow.is_exception
        ? (sourceRow.series_id as string)
        : sourceRow.id;
      const masterStart = (sourceRow.start_date.split('T')[1] || '00:00:00').slice(0, 5);
      const occurrenceStart = `${occurrenceDate}T${masterStart}:00`;

      if (sourceRow.is_exception) {
        const { error } = await supabase
          .from('events')
          .update({ is_cancelled: true })
          .eq('id', sourceRow.id);
        if (error) throw error;
        return {
          mode: 'cancelled' as const,
          eventData: { ...sourceRow, is_cancelled: true },
          occurrenceStart: sourceRow.original_start_date || occurrenceStart,
        };
      }

      // Buscar/crear excepción cancelada
      const { data: existingException } = await supabase
        .from('events')
        .select('*')
        .eq('series_id', sourceRow.series_id || sourceRow.id)
        .eq('is_exception', true)
        .eq('original_start_date', occurrenceStart)
        .maybeSingle();

      if (existingException) {
        await supabase
          .from('events')
          .update({ is_cancelled: true })
          .eq('id', existingException.id);
        return {
          mode: 'cancelled' as const,
          eventData: sourceRow,
          occurrenceStart,
          exceptionId: existingException.id,
          googleInstanceId: existingException.google_event_id,
        };
      }

      const { data: cancelled, error: insertError } = await supabase
        .from('events')
        .insert({
          project_id: sourceRow.project_id,
          title: sourceRow.title,
          description: sourceRow.description,
          start_date: occurrenceStart,
          end_date: occurrenceStart,
          series_id: sourceRow.series_id || sourceRow.id,
          is_series_master: false,
          is_exception: true,
          is_cancelled: true,
          is_recurring: true,
          original_start_date: occurrenceStart,
          created_by: user!.id,
          google_event_id: null,
          recurrence_rule: null,
          recurrence_days: null,
          recurrence_end_date: null,
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      return {
        mode: 'cancelled' as const,
        eventData: sourceRow,
        occurrenceStart,
        exceptionId: cancelled?.id,
      };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(
        result.mode === 'series_deleted'
          ? 'Serie eliminada'
          : result.mode === 'cancelled'
            ? 'Ocurrencia eliminada'
            : 'Evento eliminado',
      );

      if (result.mode === 'deleted' || result.mode === 'series_deleted') {
        await deleteEventFromGoogle(result.eventData);
        if (result.mode === 'series_deleted' && 'seriesRows' in result) {
          for (const row of result.seriesRows || []) {
            if (row.google_event_id && row.google_event_id !== result.eventData.google_event_id) {
              await deleteEventFromGoogle(row);
            }
          }
        }
        return;
      }

      // Cancelar instancia en Google si hay master vinculado
      if (canUseGoogleSync && activeIsConnected && result.eventData?.google_event_id) {
        try {
          await fetch('/api/google/sync', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: result.eventData.project_id,
              googleEventId: result.googleInstanceId || null,
              eventId: result.exceptionId || null,
              eventTitle: result.eventData.title,
              startDate: (result.occurrenceStart || '').split('T')[0],
            }),
          });
        } catch {
          // soft-fail: local ya canceló
        }
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Error al eliminar evento');
    },
  });

  const deleteEventsAndSync = async (eventIds: string[]) => {
    if (isViewer) {
      toast.error('Tu rol es Viewer: solo puedes visualizar el calendario');
      return;
    }
    const loadingToast = toast.loading(`Eliminando ${eventIds.length} evento(s)...`);

    try {
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .in('id', eventIds);

      const { error } = await supabase
        .from('events')
        .delete()
        .in('id', eventIds);

      if (error) throw error;

      if (eventsData) {
        for (const event of eventsData) {
          await deleteEventFromGoogle(event);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.dismiss(loadingToast);
      toast.success(`${eventIds.length} evento(s) eliminado(s)`);
    } catch (error: unknown) {
      toast.dismiss(loadingToast);
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar eventos';
      toast.error(errorMessage);
    }
  };

  // Eliminar todos los eventos de una fecha
  const handleDeleteAllEventsFromDate = async (_dateKey: string, eventIds: string[]) => {
    for (const id of eventIds) {
      await deleteEventMutation.mutateAsync(id);
    }
  };

  // Eliminar múltiples eventos seleccionados
  const handleDeleteMultipleEvents = async (eventIds: string[]) => {
    for (const id of eventIds) {
      await deleteEventMutation.mutateAsync(id);
    }
  };

  // Eliminar todos los eventos que ya pasaron
  const handleDeletePastEvents = async () => {
    if (isViewer) {
      toast.error('Tu rol es Viewer: solo puedes visualizar el calendario');
      return;
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const pastOccurrenceIds = displayEvents
      .filter((e) => new Date(e.start_date) < now)
      .map((e) => e.id);
    if (pastOccurrenceIds.length === 0) {
      toast.info('No hay eventos pasados para eliminar');
      return;
    }
    for (const id of pastOccurrenceIds) {
      await deleteEventMutation.mutateAsync(id);
    }
  };

  // Option 3: expandir masters a ocurrencias virtuales para la UI
  const displayEvents = useMemo(() => {
    if (!events) return [] as CalendarOccurrence[];
    return materializeEventsForUI(events as CalendarEventRow[]);
  }, [events]);

  const groupedAndSortedEvents = useMemo(() => {
    if (!displayEvents.length) return {};

    return displayEvents.reduce(
      (acc: Record<string, { events: CalendarOccurrence[]; timestamp: number }>, event) => {
        const datePart = event.start_date.split('T')[0];
        const eventDate = new Date(`${datePart}T00:00:00`);
        const dateKey = eventDate.toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        });

        if (!acc[dateKey]) {
          acc[dateKey] = { events: [], timestamp: eventDate.getTime() };
        }
        acc[dateKey].events.push(event);
        return acc;
      },
      {},
    );
  }, [displayEvents]);

  // Ordenar las fechas
  const sortedDates = useMemo(() => {
    return Object.entries(groupedAndSortedEvents)
      .sort(([, a], [, b]) => (a as { events: Event[]; timestamp: number; }).timestamp - (b as { events: Event[]; timestamp: number; }).timestamp)
      .map(([date]) => date);
  }, [groupedAndSortedEvents]);

  return (
    <>
      <div ref={ scrollContainerRef } className="flex-1 overflow-y-auto bg-[var(--bg-primary)] relative">
        <div className="p-4 md:p-6  mx-auto">
          {/* Header */ }
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
            <div>
              <h2 className="flex items-center gap-2 text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
                <CalendarIcon className="h-7 w-7 text-[var(--accent-primary)]" />
                Calendario
              </h2>
              <div className="mt-1 flex items-center gap-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  { displayEvents.length } ocurrencia{ displayEvents.length !== 1 ? 's' : '' } en total
                </p>
                { isViewer && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Modo solo lectura: tu rol Viewer no puede crear, eliminar ni sincronizar eventos.</p>
                ) }
                { (() => {
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  const pastCount = displayEvents.filter(e => new Date(e.start_date) < now).length;
                  const upcomingCount = displayEvents.length - pastCount;
                  return pastCount > 0 ? (
                    <>
                      <span className="text-[var(--text-secondary)]/40">·</span>
                      <span className="text-xs text-[var(--accent-primary)] font-medium">{ upcomingCount } próximos</span>
                      <span className="text-[var(--text-secondary)]/40">·</span>
                      <span className="text-xs text-[var(--text-secondary)]">{ pastCount } pasados</span>
                    </>
                  ) : null;
                })() }
              </div>
            </div>

            {/* Google Calendar Integration */ }
            <div className="flex flex-col gap-2">
              { !isProMember && (
                <div className="text-xs text-center sm:text-right bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[var(--text-primary)] px-2 py-1 rounded">
                  Sincronizar Google Calendar es exclusivo del plan PRO.{ ' ' }
                  <Link href="/settings/subscription" className="underline font-semibold">
                    Ver planes
                  </Link>
                </div>
              ) }
              { activeIsConnected && activeUserEmail && (
                <div className="text-xs text-[var(--text-secondary)] text-center sm:text-right flex items-center justify-center sm:justify-end gap-1">
                  { authMethod === 'google_login' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-600 dark:text-green-400">
                      Auto
                    </span>
                  ) }
                  Conectado: { activeUserEmail }
                </div>
              ) }

              {/* Mensaje para usuarios de Google que necesitan reconectar */ }
              { isProMember && isGoogleUser && needsReconnect && !activeIsConnected && (
                <div className="text-xs text-amber-600 dark:text-amber-400 text-center sm:text-right bg-amber-500/10 px-2 py-1 rounded">
                  Tu sesión de Google Calendar expiró. Reconecta para sincronizar.
                </div>
              ) }

              <div className="flex flex-col sm:flex-row gap-2">
                { canUseGoogleSync && activeIsConnected ? (
                  <>
                    { !isViewer && (
                      <Button
                        onClick={ syncAllEventsToGoogle }
                        variant="secondary"
                        disabled={ isSyncing || !events || events.length === 0 }
                      >
                        <RefreshCw className={ `h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}` } />
                        { isSyncing ? `Sincronizando (${syncProgress.current}/${syncProgress.total})` : 'Sincronizar Todos' }
                      </Button>
                    ) }
                    { !isViewer && authMethod !== 'google_login' && (
                      <Button
                        onClick={ disconnectGoogleCalendar }
                        variant="secondary"
                      >
                        🔗 Desconectar Google
                      </Button>
                    ) }
                  </>
                ) : (
                  canUseGoogleSync && (
                    <Button
                      onClick={ connectGoogleCalendar }
                      variant="secondary"
                      disabled={ isGoogleLoading }
                    >
                      { isGoogleUser && needsReconnect ? '🔄 Reconectar Calendar' : '📅 Conectar Google Calendar' }
                    </Button>
                  )
                ) }
                { !isViewer && (
                  <Button
                    onClick={ () => {
                      setEditingEvent(null);
                      setEditScope('single');
                      setIsModalOpen(true);
                      reset({
                        recurrence_type: 'none',
                        selected_days: [],
                      });
                      setSelectedDays([]);
                      setShowRecurrenceOptions(false);
                    } }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Evento
                  </Button>
                ) }
                { !isViewer && events && events.some(e => new Date(e.start_date) < (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })()) && (
                  <Button
                    variant="secondary"
                    onClick={ handleDeletePastEvents }
                    title="Eliminar todos los eventos que ya pasaron"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpiar pasados
                  </Button>
                ) }
              </div>

              { canUseGoogleSync && activeIsConnected && (
                <div className="rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] p-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--text-secondary)]">Estado de sincronización</span>
                    { isSyncing ? (
                      <span className="inline-flex items-center gap-1 text-[var(--accent-primary)]">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        En progreso
                      </span>
                    ) : lastSyncSummary?.errors ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Con observaciones
                      </span>
                    ) : lastSyncSummary ? (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Correcta
                      </span>
                    ) : (
                      <span className="text-[var(--text-secondary)]">Sin ejecuciones</span>
                    ) }
                  </div>

                  <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--bg-primary)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-primary)] transition-all duration-300"
                      style={ { width: syncProgress.total > 0 ? `${(syncProgress.current / syncProgress.total) * 100}%` : '0%' } }
                    />
                  </div>

                  { lastSyncSummary && !isSyncing && (
                    <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                      Ultima sincronizacion: { lastSyncSummary.created } creados, { lastSyncSummary.updated } actualizados, { lastSyncSummary.linked } vinculados, { lastSyncSummary.skipped } omitidos, { lastSyncSummary.errors } errores.
                    </p>
                  ) }
                </div>
              ) }


            </div>
          </div>

          { isEventsLoading ? (
            <div className="space-y-3">
              { Array.from({ length: 4 }).map((_, index) => (
                <div key={ index } className="h-20 rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] animate-pulse" />
              )) }
            </div>
          ) : events && events.length > 0 ? (
            <EventList
              groupedEvents={ groupedAndSortedEvents }
              sortedDates={ sortedDates }
              canManage={ !isViewer }
              onDeleteEvent={ (eventId) => deleteEventMutation.mutate(eventId) }
              onEditEvent={ handleEditEvent }
              onDeleteAllEventsFromDate={ handleDeleteAllEventsFromDate }
              onDeleteMultipleEvents={ handleDeleteMultipleEvents }
              onDeletePastEvents={ handleDeletePastEvents }
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="text-center">
                <CalendarIcon className="h-16 w-16 text-[var(--text-secondary)]/30 mx-auto mb-4" />
                <h3 className="text-lg md:text-xl font-semibold text-[var(--text-primary)] mb-2">
                  No hay eventos programados
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                  Crea tu primer evento para comenzar a organizar
                </p>
                { !isViewer && (
                  <Button
                    onClick={ () => setIsModalOpen(true) }
                    size="lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Evento
                  </Button>
                ) }
              </div>
            </div>
          ) }
        </div>

        {/* Create Event Modal */ }
        { !isViewer && (
          <EventModal
            isOpen={ isModalOpen }
            onClose={ closeEventModal }
            onSubmit={ (data) => {
              const formData = {
                ...data,
                selected_days: data.recurrence_type !== 'none' ? selectedDays : [],
              };

              if (isEndBeforeStart(formData)) {
                toast.error('La hora de fin no puede ser menor que la hora de inicio');
                return;
              }

              if (editingEvent) {
                if (editingEvent.is_recurring && editScope !== 'single') {
                  const scopeLabel = editScope === 'all'
                    ? 'toda la serie'
                    : 'este y los siguientes';
                  const confirmEdit = confirm(
                    `Vas a editar ${scopeLabel}. ¿Deseas continuar?`,
                  );
                  if (!confirmEdit) {
                    return;
                  }
                }

                updateEventMutation.mutate({
                  event: editingEvent,
                  data: formData,
                  scope: editingEvent.is_recurring ? editScope : 'single',
                });
                return;
              }

              createEventMutation.mutate(formData);
            } }
            handleSubmit={ handleSubmit }
            register={ register }
            errors={ errors }
            watch={ watch }
            setValue={ setValue }
            selectedDays={ selectedDays }
            setSelectedDays={ setSelectedDays }
            showRecurrenceOptions={ showRecurrenceOptions }
            setShowRecurrenceOptions={ setShowRecurrenceOptions }
            isLoading={ createEventMutation.isPending || updateEventMutation.isPending }
            mode={ editingEvent ? 'edit' : 'create' }
            editScope={ editScope }
            setEditScope={ setEditScope }
            isEditingRecurring={ !!editingEvent?.is_recurring }
          />
        ) }
      </div>

      {/* Botón Scroll to Top */ }
      { showScrollTop && (
        <button
          onClick={ scrollToTop }
          className="fixed bottom-6 right-6 z-50 p-3 bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all"
          aria-label="Volver arriba"
          title="Volver arriba"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      ) }
    </>
  );
};
