'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/Button';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Calendar as CalendarIcon, Plus, ArrowUp, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useGoogleCalendarTokens } from '@/hooks/useGoogleCalendarTokens';
import { useRouter, useSearchParams } from 'next/navigation';
import { EventModal } from '@/components/calendar/EventModal';
import { EventList } from '@/components/calendar/EventList';
import { generateRecurringEvents } from '@/lib/calendarUtils';

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

interface Event {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  project_id: string;
  created_by: string;
  recurrence_rule: string | null;
  is_recurring: boolean;
  creator: {
    name: string;
    email: string;
  };
}

interface SyncPayloadEvent {
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
  skipped: number;
  errors: number;
  at: string;
}

const SYNC_BATCH_SIZE = 20;

const toSyncPayloadEvent = (event: Event, userTimeZone: string): SyncPayloadEvent => {
  const startParts = event.start_date.includes('T')
    ? event.start_date.split('T')
    : [event.start_date, '00:00:00'];
  const endParts = event.end_date.includes('T')
    ? event.end_date.split('T')
    : [event.end_date, '23:59:00'];

  return {
    title: event.title,
    description: event.description || '',
    start_date: startParts[0],
    start_time: startParts[1].slice(0, 5),
    end_date: endParts[0],
    end_time: endParts[1].slice(0, 5),
    is_recurring: event.is_recurring || false,
    recurrence_rule: event.recurrence_rule,
    timeZone: userTimeZone,
  };
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const oauthProcessedRef = useRef(false);
  const { user } = useAuthStore();
  const { currentProject } = useProjectStore();
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

  // Conectar con Google Calendar (usando hook unificado)
  const connectGoogleCalendar = async () => {
    try {
      await connectGoogle(currentProject?.id);
    } catch (error) {
      console.error('Error al conectar con Google Calendar:', error);
      toast.error('Error al conectar con Google Calendar');
    }
  };

  // Desconectar Google Calendar (usando hook unificado)
  const disconnectGoogleCalendar = async () => {
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
      return { success: true, skipped: data.skipped || false };
    } catch (error) {
      console.error('Error al sincronizar con Google:', error);
      return { success: false, skipped: false };
    }
  };

  const syncEventsBatchToGoogle = async (eventsBatch: SyncPayloadEvent[], checkDuplicate = false) => {
    if (!activeTokens) {
      return { created: 0, skipped: 0, errors: eventsBatch.length };
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
        skipped: data.skipped || 0,
        errors: data.errors || 0,
      };
    } catch (error) {
      console.error('Error al sincronizar lote con Google:', error);
      return { created: 0, skipped: 0, errors: eventsBatch.length };
    }
  };

  // Eliminar evento de Google Calendar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deleteEventFromGoogle = async (event: any) => {
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
    if (!activeTokens || !events || events.length === 0) {
      toast.error('No hay eventos para sincronizar');
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: events.length });
    const loadingToast = toast.loading(`Sincronizando ${events.length} evento(s)...`);
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
      const payloadEvents = events.map((event) => toSyncPayloadEvent(event, userTimeZone));

      for (let index = 0; index < payloadEvents.length; index += SYNC_BATCH_SIZE) {
        const batch = payloadEvents.slice(index, index + SYNC_BATCH_SIZE);
        const result = await syncEventsBatchToGoogle(batch, true);
        createdCount += result.created;
        skippedCount += result.skipped;
        errorCount += result.errors;

        setSyncProgress({ current: Math.min(index + SYNC_BATCH_SIZE, payloadEvents.length), total: payloadEvents.length });
      }

      toast.dismiss(loadingToast);
      setLastSyncSummary({
        created: createdCount,
        skipped: skippedCount,
        errors: errorCount,
        at: new Date().toISOString(),
      });

      if (errorCount === 0 && skippedCount === 0) {
        toast.success(`${createdCount} evento(s) sincronizado(s) exitosamente`);
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

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const events = generateRecurringEvents(data);

      // Crear múltiples eventos si es recurrente
      for (const event of events) {
        const { error } = await supabase
          .from('events')
          .insert({
            project_id: currentProject!.id,
            title: data.title,
            description: data.description,
            start_date: event.start,
            end_date: event.end,
            recurrence_rule: data.recurrence_type === 'none' ? null : data.recurrence_type,
            is_recurring: data.recurrence_type !== 'none',
            recurrence_days: data.selected_days,
            recurrence_end_date: data.recurrence_end_date,
            created_by: user!.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento(s) creado(s) exitosamente');

      // Sincronizar con Google Calendar si está conectado
      if (activeIsConnected && activeTokens) {
        const generatedEvents = generateRecurringEvents(variables);
        let syncFailures = 0;

        if (variables.recurrence_type !== 'none' && generatedEvents.length > 0) {
          // Si es recurrente, solo sincronizamos el primer evento como una serie recurrente
          const event = generatedEvents[0];
          const [startDate, startTime] = event.start.split('T');
          const [endDate, endTimeStr] = event.end.split('T');
          const endTime = endTimeStr.split(':').slice(0, 2).join(':'); // HH:MM

          const result = await syncEventToGoogle({
            title: variables.title,
            description: variables.description,
            start_date: startDate,
            start_time: startTime.slice(0, 5),
            end_date: endDate,
            end_time: endTime,
            is_recurring: true,
            recurrence_rule: variables.recurrence_type,
            selected_days: variables.selected_days,
            recurrence_end_date: variables.recurrence_end_date,
            timeZone: userTimeZone,
          });

          if (!result.success) {
            syncFailures += 1;
          }
        } else {
          // Si no es recurrente, sincronizamos individualmente
          for (const event of generatedEvents) {
            // Separar fecha y hora de los strings completos
            const [startDate, startTime] = event.start.split('T');
            const [endDate, endTimeStr] = event.end.split('T');
            const endTime = endTimeStr.split(':').slice(0, 2).join(':'); // HH:MM

            const result = await syncEventToGoogle({
              title: variables.title,
              description: variables.description,
              start_date: startDate,
              start_time: startTime.slice(0, 5), // HH:MM
              end_date: endDate,
              end_time: endTime,
              is_recurring: false,
              recurrence_rule: 'none',
              selected_days: [],
              timeZone: userTimeZone,
            });

            if (!result.success) {
              syncFailures += 1;
            }
          }
        }

        if (syncFailures > 0) {
          toast.warning(`El evento se guardo en Veenzo, pero ${syncFailures} sincronizacion(es) con Google fallaron.`);
        }
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

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      // Primero obtener el evento para tener su información
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      // Eliminar de la base de datos
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      return eventData;
    },
    onSuccess: async (eventData) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento eliminado');

      // Eliminar de Google Calendar para todas las cuentas conectadas
      if (eventData) {
        await deleteEventFromGoogle(eventData);
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Error al eliminar evento');
    },
  });

  const deleteEventsAndSync = async (eventIds: string[]) => {
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
    await deleteEventsAndSync(eventIds);
  };

  // Eliminar múltiples eventos seleccionados
  const handleDeleteMultipleEvents = async (eventIds: string[]) => {
    await deleteEventsAndSync(eventIds);
  };

  // Memoizar eventos agrupados por fecha
  const groupedAndSortedEvents = useMemo(() => {
    if (!events) return {};

    return events.reduce((acc: Record<string, { events: Event[]; timestamp: number; }>, event: Event) => {
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
    }, {});
  }, [events]);

  // Ordenar las fechas
  const sortedDates = useMemo(() => {
    return Object.entries(groupedAndSortedEvents)
      .sort(([, a], [, b]) => (a as { events: Event[]; timestamp: number; }).timestamp - (b as { events: Event[]; timestamp: number; }).timestamp)
      .map(([date]) => date);
  }, [groupedAndSortedEvents]);

  return (
    <>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-[var(--bg-primary)] relative">
        <div className="p-4 md:p-6  mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
                📅 Calendario
              </h2>
              <p className="text-sm md:text-base text-[var(--text-secondary)] mt-1">
                {events?.length || 0} evento(s) programado(s)
              </p>
            </div>

            {/* Google Calendar Integration */}
            <div className="flex flex-col gap-2">
              {activeIsConnected && activeUserEmail && (
                <div className="text-xs text-[var(--text-secondary)] text-center sm:text-right flex items-center justify-center sm:justify-end gap-1">
                  {authMethod === 'google_login' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-600 dark:text-green-400">
                      Auto
                    </span>
                  )}
                  Conectado: {activeUserEmail}
                </div>
              )}

              {/* Mensaje para usuarios de Google que necesitan reconectar */}
              {isGoogleUser && needsReconnect && !activeIsConnected && (
                <div className="text-xs text-amber-600 dark:text-amber-400 text-center sm:text-right bg-amber-500/10 px-2 py-1 rounded">
                  Tu sesión de Google Calendar expiró. Reconecta para sincronizar.
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                {activeIsConnected ? (
                  <>
                    <Button
                      onClick={syncAllEventsToGoogle}
                      variant="secondary"
                      disabled={isSyncing || !events || events.length === 0}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? `Sincronizando (${syncProgress.current}/${syncProgress.total})` : 'Sincronizar Todos'}
                    </Button>
                    {authMethod !== 'google_login' && (
                      <Button
                        onClick={disconnectGoogleCalendar}
                        variant="secondary"
                      >
                        🔗 Desconectar Google
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    onClick={connectGoogleCalendar}
                    variant="secondary"
                    disabled={isGoogleLoading}
                  >
                    {isGoogleUser && needsReconnect ? '🔄 Reconectar Calendar' : '📅 Conectar Google Calendar'}
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setIsModalOpen(true);
                    reset();
                    setSelectedDays([]);
                    setShowRecurrenceOptions(false);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Evento
                </Button>
              </div>

              {activeIsConnected && (
                <div className="rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] p-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--text-secondary)]">Estado de sincronización</span>
                    {isSyncing ? (
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
                    )}
                  </div>

                  <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--bg-primary)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-primary)] transition-all duration-300"
                      style={{ width: syncProgress.total > 0 ? `${(syncProgress.current / syncProgress.total) * 100}%` : '0%' }}
                    />
                  </div>

                  {lastSyncSummary && !isSyncing && (
                    <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                      Ultima sincronizacion: {lastSyncSummary.created} creados, {lastSyncSummary.skipped} omitidos, {lastSyncSummary.errors} errores.
                    </p>
                  )}
                </div>
              )}


            </div>
          </div>

          {isEventsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] animate-pulse" />
              ))}
            </div>
          ) : events && events.length > 0 ? (
            <EventList
              groupedEvents={groupedAndSortedEvents}
              sortedDates={sortedDates}
              onDeleteEvent={(eventId) => deleteEventMutation.mutate(eventId)}
              onDeleteAllEventsFromDate={handleDeleteAllEventsFromDate}
              onDeleteMultipleEvents={handleDeleteMultipleEvents}
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
                <Button
                  onClick={() => setIsModalOpen(true)}
                  size="lg"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Evento
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Create Event Modal */}
        <EventModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setShowRecurrenceOptions(false);
            setSelectedDays([]);
          }}
          onSubmit={(data) => {
            const formData = {
              ...data,
              selected_days: data.recurrence_type !== 'none' ? selectedDays : [],
            };
            createEventMutation.mutate(formData);
          }}
          handleSubmit={handleSubmit}
          register={register}
          errors={errors}
          watch={watch}
          setValue={setValue}
          selectedDays={selectedDays}
          setSelectedDays={setSelectedDays}
          showRecurrenceOptions={showRecurrenceOptions}
          setShowRecurrenceOptions={setShowRecurrenceOptions}
          isLoading={createEventMutation.isPending}
        />
      </div>

      {/* Botón Scroll to Top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 p-3 bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all"
          aria-label="Volver arriba"
          title="Volver arriba"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </>
  );
};
