'use client';

import React from 'react';
import { Clock, Repeat, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';

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
  onDeleteMultipleEvents?: (eventIds: string[]) => void;
}

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
  onDeleteMultipleEvents,
}) => {
  const [selectedEvents, setSelectedEvents] = React.useState<Set<string>>(new Set());

  const allEventIds = React.useMemo(() => {
    return sortedDates.flatMap(dateKey => groupedEvents[dateKey].events.map(e => e.id));
  }, [groupedEvents, sortedDates]);

  const areAllSelected = allEventIds.length > 0 && allEventIds.every(id => selectedEvents.has(id));

  const toggleSelectAll = () => {
    if (areAllSelected) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(allEventIds));
    }
  };

  const toggleEventSelection = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const toggleDateSelection = (eventIds: string[]) => {
    const newSelected = new Set(selectedEvents);
    const allSelected = eventIds.every(id => newSelected.has(id));

    if (allSelected) {
      eventIds.forEach(id => newSelected.delete(id));
    } else {
      eventIds.forEach(id => newSelected.add(id));
    }
    setSelectedEvents(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedEvents.size === 0) return;
    if (confirm(`¿Eliminar los ${selectedEvents.size} eventos seleccionados?`)) {
      onDeleteMultipleEvents?.(Array.from(selectedEvents));
      setSelectedEvents(new Set());
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {allEventIds.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={areAllSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-[var(--text-secondary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
              id="select-all-events"
            />
            <label htmlFor="select-all-events" className="text-sm font-medium text-[var(--text-primary)] cursor-pointer select-none">
              Seleccionar todos los eventos ({allEventIds.length})
            </label>
          </div>
        </div>
      )}

      {selectedEvents.size > 0 && (
        <div className="sticky top-20 z-20 bg-[var(--bg-secondary)] border border-[var(--accent-primary)] p-3 rounded-lg shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium">
            {selectedEvents.size} evento{selectedEvents.size !== 1 ? 's' : ''} seleccionado{selectedEvents.size !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button
              variant='ghost'
              onClick={() => setSelectedEvents(new Set())}
            >
              Cancelar
            </Button>
            <Button
              variant='danger'
              onClick={handleDeleteSelected}

            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Eliminar Seleccionados
            </Button>
          </div>
        </div>
      )}

      {sortedDates.map((dateKey) => {
        const dateEvents = groupedEvents[dateKey].events;
        const allDateEventsSelected = dateEvents.every(e => selectedEvents.has(e.id));

        return (
          <div key={dateKey} className="space-y-2">
            <div className="sticky top-0 z-10 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-primary)]/80 px-3 py-2 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allDateEventsSelected}
                    onChange={() => toggleDateSelection(dateEvents.map(e => e.id))}
                    className="w-4 h-4 rounded border-white/30 text-[var(--accent-primary)] focus:ring-offset-0 focus:ring-white/50 cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm md:text-base font-semibold text-white">
                      {dateKey}
                    </h3>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-white">
                      {dateEvents.length} evento{dateEvents.length !== 1 ? 's' : ''}
                    </span>
                  </div>
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
                    className={`group bg-[var(--bg-secondary)] border rounded-lg p-3 transition-all ${selectedEvents.has(event.id)
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                      : 'border-[var(--text-secondary)]/20 hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-primary)]'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedEvents.has(event.id)}
                        onChange={() => toggleEventSelection(event.id)}
                        className="w-4 h-4 rounded border-[var(--text-secondary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
                      />

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
