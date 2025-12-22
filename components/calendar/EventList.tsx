'use client';

import React from 'react';
import { Clock, Repeat, CalendarIcon, Trash2 } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
  creator?: {
    name: string;
    email: string;
  };
}

interface EventListProps {
  groupedEvents: Record<string, { events: Event[]; timestamp: number; }>;
  sortedDates: string[];
  onDeleteEvent: (eventId: string) => void;
  onDeleteAllEventsFromDate?: (dateKey: string, eventIds: string[]) => void;
}

const getDateKey = (iso: string) => {
  const datePart = iso.split('T')[0];
  const dateObj = new Date(`${datePart}T00:00:00`);
  return dateObj;
};

const formatTimeHM = (iso: string) => {
  const timePart = (iso.split('T')[1] || '00:00:00').split('+')[0];
  const [h, m] = timePart.split(':');
  return `${h}:${m}`;
};

export const EventList: React.FC<EventListProps> = ({
  groupedEvents,
  sortedDates,
  onDeleteEvent,
  onDeleteAllEventsFromDate,
}) => {
  return (
    <div className="space-y-4 pb-6">
      {sortedDates.map((dateKey) => {
        const dateEvents = groupedEvents[dateKey].events;
        return (
          <div key={dateKey} className="space-y-2">
            <div className="sticky top-0 z-10 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-primary)]/80 px-3 py-2 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm md:text-base font-semibold text-white">
                    {dateKey}
                  </h3>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-white">
                    {dateEvents.length} evento{dateEvents.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {onDeleteAllEventsFromDate && dateEvents.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar todos los ${dateEvents.length} evento(s) de esta fecha?`)) {
                        onDeleteAllEventsFromDate(dateKey, dateEvents.map(e => e.id));
                      }
                    }}
                    className="p-1.5 rounded hover:bg-white/20 text-white transition-all"
                    aria-label="Eliminar todos los eventos de esta fecha"
                    title="Eliminar todos los eventos de esta fecha"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {dateEvents
                .sort((a, b) =>
                  new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
                )
                .map((event) => (
                  <div
                    key={event.id}
                    className="group bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 hover:border-[var(--accent-primary)]/50 rounded-lg p-3 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 flex flex-col items-center justify-center bg-[var(--accent-primary)]/10 rounded-lg px-3 py-2 min-w-[70px]">
                        {event.is_recurring ? (
                          <Repeat className="h-4 w-4 text-[var(--accent-primary)] mb-1" />
                        ) : (
                          <Clock className="h-4 w-4 text-[var(--accent-primary)] mb-1" />
                        )}
                        <span className="text-xs font-bold text-[var(--accent-primary)]">
                          {formatTimeHM(event.start_date)}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-[var(--text-primary)] text-sm truncate">
                              {event.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-[var(--text-secondary)]">
                                Hasta {formatTimeHM(event.end_date)}
                              </span>
                              {event.is_recurring && (
                                <span className="inline-block px-1.5 py-0.5 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-xs rounded">
                                  {event.recurrence_rule || 'Recurrente'}
                                </span>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-1">
                                {event.description}
                              </p>
                            )}
                            <p className="text-xs text-[var(--text-secondary)] mt-1">
                              {event.creator?.name || 'Usuario'}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm('¿Eliminar este evento?')) {
                                onDeleteEvent(event.id);
                              }
                            }}
                            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 transition-all flex-shrink-0"
                            aria-label="Eliminar evento"
                            title="Eliminar evento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
