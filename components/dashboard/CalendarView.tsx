'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/Button';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Calendar as CalendarIcon, Plus, ArrowUp } from 'lucide-react';
import { useGoogleCalendarStore } from '@/store/googleCalendarStore';
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

export const CalendarView: React.FC = () => {
  const supabase = createClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const oauthProcessedRef = useRef(false);
  const { user } = useAuthStore();
  const { currentProject } = useProjectStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tokens, isConnected, userEmail, setTokens, disconnect, clearIfDifferentUser } = useGoogleCalendarStore();
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

  // Cargar tokens desde Supabase al montar el componente

  useEffect(() => {
    const loadTokensFromSupabase = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('google_calendar_tokens')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error || !data) return;
        const now = new Date();
        const expiresAt = data.expires_at ? new Date(data.expires_at) : null;

        if (expiresAt && now > expiresAt) {
          toast.warning('Sesión de Google expirada. Por favor, vuelve a conectar.');
          await supabase.from('google_calendar_tokens').delete().eq('user_id', user.id);
          disconnect();
          return;
        }

        if (data.user_id !== user.id) {
          clearIfDifferentUser(data.user_email);

        }
        const tokens = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          scope: data.scope,
          token_type: data.token_type,
          expiry_date: expiresAt ? expiresAt.getTime() : null,
        };

        setTokens(tokens, data.user_email);
      } catch (error) {
        console.error('Error cargando tokens:', error);
      }
    };

    loadTokensFromSupabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Manejar callback de Google OAuth (solo una vez)
  useEffect(() => {
    const handleGoogleAuth = async () => {
      // Evitar procesamiento múltiple del mismo callback
      if (oauthProcessedRef.current) return;

      const googleAuthParam = searchParams?.get('google_auth');
      const error = searchParams?.get('error');

      if (!googleAuthParam && !error) return;

      oauthProcessedRef.current = true;

      // Procesar datos de autenticación de Google Calendar
      if (googleAuthParam) {
        try {
          // Decodificar datos desde Base64
          const authJson = atob(googleAuthParam);
          const authData = JSON.parse(authJson);
          const { tokens, userEmail: newUserEmail } = authData;

          // Verificar si hay un usuario diferente ya conectado
          if (userEmail && newUserEmail && userEmail !== newUserEmail) {
            disconnect();
            toast.info(`Cambiando a cuenta de Google: ${newUserEmail}`);
          }

          // Guardar tokens en Supabase
          try {
            const existingUserId = user?.id || newUserEmail;
            const expiresAt = tokens.expiry_date
              ? new Date(tokens.expiry_date).toISOString()
              : null;

            const { data: existing } = await supabase
              .from('google_calendar_tokens')
              .select('id')
              .eq('user_id', existingUserId)
              .maybeSingle();

            const tokenData = {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || null,
              scope: tokens.scope || 'https://www.googleapis.com/auth/calendar',
              token_type: tokens.token_type || 'Bearer',
              expires_at: expiresAt,
              user_email: newUserEmail,
              ...(existing && { updated_at: new Date().toISOString() }),
            };

            const { error } = existing
              ? await supabase
                .from('google_calendar_tokens')
                .update(tokenData)
                .eq('user_id', existingUserId)
              : await supabase
                .from('google_calendar_tokens')
                .insert({ ...tokenData, user_id: existingUserId });

            if (error) {
              console.error('Error guardando tokens:', error);
              toast.error('Error al guardar tokens en la base de datos');
              return;
            }
          } catch (saveError) {
            console.error('Error al guardar tokens:', saveError);
            toast.error('Error al guardar tokens en la base de datos');
            return;
          }

          setTokens(tokens, newUserEmail);

          toast.success('Google Calendar conectado exitosamente');
        } catch (error) {
          console.error('Error al procesar datos de autenticación:', error);
          toast.error('Error al conectar con Google Calendar');
        }

        // Limpiar URL
        if (currentProject?.id) {
          router.replace(`/projects/${currentProject.id}/calendar`);
        } else {
          router.replace('/dashboard');
        }
      }

      if (error) {
        toast.error(decodeURIComponent(error));
        if (currentProject?.id) {
          router.replace(`/projects/${currentProject.id}/calendar`);
        } else {
          router.replace('/dashboard');
        }
      }
    };

    handleGoogleAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Conectar con Google Calendar
  const connectGoogleCalendar = async () => {
    try {
      const projectId = currentProject?.id || '';
      const response = await fetch(`/api/google/auth-url?projectId=${projectId}`);
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error al obtener URL de autorización:', error);
      toast.error('Error al conectar con Google Calendar');
    }
  };

  // Desconectar Google Calendar
  const disconnectGoogleCalendar = () => {
    disconnect();
    toast.info('Google Calendar desconectado');
  };

  // Sincronizar evento con Google Calendar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncEventToGoogle = async (event: any, checkDuplicate = false) => {
    if (!tokens) {
      return { success: false, skipped: false };
    }

    try {
      const response = await fetch('/api/google/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokens, event: { ...event, timeZone: userTimeZone }, checkDuplicate }),
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

  // Eliminar evento de Google Calendar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deleteEventFromGoogle = async (event: any) => {
    const projectId = event.project_id || currentProject?.id;
    const startDate = typeof event.start_date === 'string'
      ? event.start_date.split('T')[0]
      : '';

    if (!projectId && !tokens) {
      return;
    }

    try {
      const response = await fetch('/api/google/sync', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens,
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
    if (!tokens || !events || events.length === 0) {
      toast.error('No hay eventos para sincronizar');
      return;
    }

    setIsSyncing(true);
    const loadingToast = toast.loading(`Sincronizando ${events.length} evento(s)...`);
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
      for (const event of events) {
        try {
          // Extraer fecha y hora de start_date y end_date
          const startParts = event.start_date.includes('T')
            ? event.start_date.split('T')
            : [event.start_date, '00:00:00'];
          const endParts = event.end_date.includes('T')
            ? event.end_date.split('T')
            : [event.end_date, '23:59:00'];

          const result = await syncEventToGoogle({
            title: event.title,
            description: event.description || '',
            start_date: startParts[0],
            start_time: startParts[1].slice(0, 5),
            end_date: endParts[0],
            end_time: endParts[1].slice(0, 5),
            is_recurring: event.is_recurring || false,
            recurrence_rule: event.recurrence_rule,
            timeZone: userTimeZone,
          }, true); // checkDuplicate = true

          if (result.skipped) {
            skippedCount++;
          } else if (result.success) {
            successCount++;
          }
        } catch (error) {
          console.error(`Error al sincronizar evento ${event.id}:`, error);
          errorCount++;
        }
      }

      toast.dismiss(loadingToast);

      if (errorCount === 0 && skippedCount === 0) {
        toast.success(`${successCount} evento(s) sincronizado(s) exitosamente`);
      } else if (errorCount === 0) {
        toast.success(`${successCount} sincronizados, ${skippedCount} ya existían`);
      } else {
        toast.warning(`${successCount} sincronizados, ${skippedCount} omitidos, ${errorCount} errores`);
      }
    } catch {
      toast.dismiss(loadingToast);
      toast.error('Error al sincronizar eventos');
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch events
  const { data: events } = useQuery({
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
      if (isConnected && tokens) {
        const generatedEvents = generateRecurringEvents(variables);

        if (variables.recurrence_type !== 'none' && generatedEvents.length > 0) {
          // Si es recurrente, solo sincronizamos el primer evento como una serie recurrente
          const event = generatedEvents[0];
          const [startDate, startTime] = event.start.split('T');
          const [endDate, endTimeStr] = event.end.split('T');
          const endTime = endTimeStr.split(':').slice(0, 2).join(':'); // HH:MM

          await syncEventToGoogle({
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
        } else {
          // Si no es recurrente, sincronizamos individualmente
          for (const event of generatedEvents) {
            // Separar fecha y hora de los strings completos
            const [startDate, startTime] = event.start.split('T');
            const [endDate, endTimeStr] = event.end.split('T');
            const endTime = endTimeStr.split(':').slice(0, 2).join(':'); // HH:MM

            await syncEventToGoogle({
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
          }
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

  // Eliminar todos los eventos de una fecha
  const handleDeleteAllEventsFromDate = async (dateKey: string, eventIds: string[]) => {
    const loadingToast = toast.loading(`Eliminando ${eventIds.length} evento(s)...`);

    try {
      // Obtener datos de los eventos antes de eliminarlos (para Google Calendar)
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .in('id', eventIds);

      // Eliminar todos los eventos de la base de datos
      const { error } = await supabase
        .from('events')
        .delete()
        .in('id', eventIds);

      if (error) throw error;

      // Eliminar de Google Calendar para todas las cuentas conectadas
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

  // Eliminar múltiples eventos seleccionados
  const handleDeleteMultipleEvents = async (eventIds: string[]) => {
    const loadingToast = toast.loading(`Eliminando ${eventIds.length} evento(s)...`);

    try {
      // Obtener datos de los eventos antes de eliminarlos (para Google Calendar)
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .in('id', eventIds);

      // Eliminar todos los eventos de la base de datos
      const { error } = await supabase
        .from('events')
        .delete()
        .in('id', eventIds);

      if (error) throw error;

      // Eliminar de Google Calendar para todas las cuentas conectadas
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
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
                📅 Calendario
              </h2>
              <p className="text-sm md:text-base text-[var(--text-secondary)] mt-1">
                {events?.length || 0} evento(s) programado(s)
              </p>
            </div>

            {/* Google Calendar Integration */}
            <div className="flex flex-col gap-2">
              {isConnected && userEmail && (
                <div className="text-xs text-[var(--text-secondary)] text-center sm:text-right">
                  Conectado: {userEmail}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                {isConnected ? (
                  <>
                    <Button
                      onClick={syncAllEventsToGoogle}
                      variant="secondary"
                      disabled={isSyncing || !events || events.length === 0}
                    >
                      🔄 Sincronizar Todos
                    </Button>
                    <Button
                      onClick={disconnectGoogleCalendar}
                      variant="secondary"
                    >
                      🔗 Desconectar Google
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={connectGoogleCalendar}
                    variant="secondary"
                  >
                    📅 Conectar Google Calendar
                  </Button>
                )}
              </div>

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
          </div>

          {events && events.length > 0 ? (
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
          className="fixed bottom-6 right-6 z-50 p-3 bg-[var(--accent-primary)] text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all"
          aria-label="Volver arriba"
          title="Volver arriba"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </>
  );
};
