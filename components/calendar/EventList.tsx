'use client';

import React from 'react';
import { CalendarClock, ChevronDown, ChevronRight, Clock, History, Repeat, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { DateRangePicker } from '../ui/DateRangePicker';

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
  onDeletePastEvents?: () => void;
}

const formatTimeHM = (iso: string) => {
  const timePart = (iso.split('T')[1] || '00:00:00').split('+')[0];
  const [h, m] = timePart.split(':');
  return `${h}:${m}`;
};

const getRelativeLabel = (timestamp: number): string | null => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (timestamp >= todayStart && timestamp < todayStart + 86400000) return 'Hoy';
  if (timestamp >= todayStart + 86400000 && timestamp < todayStart + 172800000) return 'Mañana';
  return null;
};

export const EventList: React.FC<EventListProps> = ({
  groupedEvents,
  sortedDates,
  onDeleteEvent,
  onDeleteAllEventsFromDate,
  onDeleteMultipleEvents,
  onDeletePastEvents,
}) => {
  const [selectedEvents, setSelectedEvents] = React.useState<Set<string>>(new Set());
  const [isPastExpanded, setIsPastExpanded] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<'all' | 'upcoming' | 'past' | 'recurring' | 'one-time'>('all');
  const [filterFrom, setFilterFrom] = React.useState<Date | undefined>(undefined);
  const [filterTo, setFilterTo] = React.useState<Date | undefined>(undefined);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);

  const { pastDates, upcomingDates } = React.useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return {
      pastDates: sortedDates.filter(dk => groupedEvents[dk].timestamp < todayStart),
      upcomingDates: sortedDates.filter(dk => groupedEvents[dk].timestamp >= todayStart),
    };
  }, [sortedDates, groupedEvents]);

  const allEventsFlat = React.useMemo(
    () => sortedDates.flatMap(dk => groupedEvents[dk].events),
    [groupedEvents, sortedDates],
  );

  const visibleEventIds = React.useMemo((): Set<string> => {
    const toDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return new Set(
      allEventsFlat.filter(e => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!e.title.toLowerCase().includes(q) && !(e.description || '').toLowerCase().includes(q)) return false;
        }
        if (filterType === 'recurring' && !e.is_recurring) return false;
        if (filterType === 'one-time' && e.is_recurring) return false;
        const eventDateStr = e.start_date.split('T')[0];
        if (filterFrom && eventDateStr < toDateStr(filterFrom)) return false;
        if (filterTo && eventDateStr > toDateStr(filterTo)) return false;
        return true;
      }).map(e => e.id),
    );
  }, [allEventsFlat, searchQuery, filterType, filterFrom, filterTo]);

  const allEventIds = React.useMemo(
    () => allEventsFlat.filter(e => visibleEventIds.has(e.id)).map(e => e.id),
    [allEventsFlat, visibleEventIds],
  );

  const pastEventCount = React.useMemo(
    () => pastDates.reduce((sum, dk) => sum + groupedEvents[dk].events.length, 0),
    [pastDates, groupedEvents],
  );

  const areAllSelected = allEventIds.length > 0 && allEventIds.every(id => selectedEvents.has(id));

  const activeFilterCount = [
    searchQuery !== '',
    filterType !== 'all',
    filterFrom !== undefined,
    filterTo !== undefined,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setFilterFrom(undefined);
    setFilterTo(undefined);
  };

  React.useEffect(() => {
    setSelectedEvents(prev => {
      const next = new Set([...prev].filter(id => visibleEventIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleEventIds]);

  React.useEffect(() => {
    if (filterType === 'past') setIsPastExpanded(true);
  }, [filterType]);

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

  const renderDateGroup = (dateKey: string, isPast: boolean) => {
    const dateEvents = groupedEvents[dateKey].events.filter(e => visibleEventIds.has(e.id));
    if (dateEvents.length === 0) return null;
    const allDateEventsSelected = dateEvents.every(e => selectedEvents.has(e.id));
    const relativeLabel = getRelativeLabel(groupedEvents[dateKey].timestamp);

    return (
      <div key={dateKey} className="space-y-1.5">
        <div
          className={`sticky top-0 z-10 px-3 py-2 rounded-lg shadow-sm ${isPast
            ? 'bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20'
            : 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-primary)]/80'
            }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={allDateEventsSelected}
                onChange={() => toggleDateSelection(dateEvents.map(e => e.id))}
                className={`w-4 h-4 rounded cursor-pointer ${isPast ? 'border-[var(--text-secondary)]/40' : 'border-white/30 focus:ring-offset-0 focus:ring-white/50'
                  }`}
              />
              {relativeLabel && (
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPast ? 'bg-[var(--text-secondary)]/15 text-[var(--text-secondary)]' : 'bg-white text-[var(--accent-primary)]'
                    }`}
                >
                  {relativeLabel}
                </span>
              )}
              <h3 className={`text-sm font-semibold capitalize ${isPast ? 'text-[var(--text-secondary)]' : 'text-white'
                }`}>
                {dateKey}
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${isPast ? 'bg-[var(--text-secondary)]/15 text-[var(--text-secondary)]' : 'bg-white/20 text-white'
                }`}>
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
                className={`p-1.5 rounded transition-all ${isPast
                  ? 'text-[var(--text-secondary)]/60 hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-500'
                  : 'text-white hover:bg-white/20'
                  }`}
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
            .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
            .map((event) => (
              <div
                key={event.id}
                className={`group border rounded-xl p-3 transition-all ${selectedEvents.has(event.id)
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                  : isPast
                    ? 'border-[var(--text-secondary)]/15 bg-[var(--bg-secondary)]/50 opacity-65'
                    : 'border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-primary)]'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedEvents.has(event.id)}
                    onChange={() => toggleEventSelection(event.id)}
                    className="mt-0.5 w-4 h-4 rounded border-[var(--text-secondary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
                  />

                  <div className={`flex-shrink-0 flex flex-col items-center justify-center rounded-lg px-2.5 py-2 min-w-[58px] text-center ${isPast ? 'bg-[var(--bg-primary)]/60' : 'bg-[var(--accent-primary)]/10'
                    }`}>
                    {event.is_recurring ? (
                      <Repeat className={`h-3.5 w-3.5 mb-0.5 ${isPast ? 'text-[var(--text-secondary)]' : 'text-[var(--accent-primary)]'}`} />
                    ) : (
                      <Clock className={`h-3.5 w-3.5 mb-0.5 ${isPast ? 'text-[var(--text-secondary)]' : 'text-[var(--accent-primary)]'}`} />
                    )}
                    <span className={`text-xs font-bold ${isPast ? 'text-[var(--text-secondary)]' : 'text-[var(--accent-primary)]'}`}>
                      {formatTimeHM(event.start_date)}
                    </span>
                    <span className={`text-[10px] leading-none ${isPast ? 'text-[var(--text-secondary)]/60' : 'text-[var(--text-secondary)]'}`}>
                      → {formatTimeHM(event.end_date)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <h4 className={`font-semibold text-sm ${isPast ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'
                            }`}>
                            {event.title}
                          </h4>
                          {isPast && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] rounded-full">
                              Pasado
                            </span>
                          )}
                          {event.is_recurring && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-full">
                              Recurrente
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
                            {event.description}
                          </p>
                        )}
                        <p className="text-xs text-[var(--text-secondary)]/60 mt-0.5">
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
  };

  const TYPE_LABELS: Record<string, string> = {
    all: 'Todos',
    upcoming: 'Próximos',
    past: 'Pasados',
    recurring: 'Recurrentes',
    'one-time': 'Únicos',
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Barra de filtros */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por título o descripción..."
              className="h-9 w-full rounded-lg border border-[var(--text-secondary)]/25 bg-[var(--bg-secondary)] pl-9 pr-8 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsFilterOpen(v => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${isFilterOpen || activeFilterCount > 0
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                : 'border-[var(--text-secondary)]/25 bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50'
              }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-primary)] text-[10px] font-bold text-[var(--accent-primary-contrast)]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {isFilterOpen && (
          <div className="space-y-3 rounded-xl border border-[var(--text-secondary)]/15 bg-[var(--bg-secondary)]/70 p-3">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Tipo</p>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'upcoming', 'past', 'recurring', 'one-time'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFilterType(type)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${filterType === type
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)]'
                        : 'border border-[var(--text-secondary)]/25 bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)]'
                      }`}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Rango de fechas</p>
              <DateRangePicker
                startValue={filterFrom}
                endValue={filterTo}
                onStartChange={setFilterFrom}
                onEndChange={setFilterTo}
                startLabel="Desde"
                endLabel="Hasta"
                className="grid grid-cols-2 gap-2"
              />
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* Chips de filtros activos */}
        {activeFilterCount > 0 && !isFilterOpen && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[var(--text-secondary)]">Aplicados:</span>
            {filterType !== 'all' && (
              <span className="flex items-center gap-1 rounded-full bg-[var(--accent-primary)]/10 px-2 py-0.5 text-xs text-[var(--accent-primary)]">
                {TYPE_LABELS[filterType]}
                <button type="button" onClick={() => setFilterType('all')} className="ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {(filterFrom || filterTo) && (
              <span className="flex items-center gap-1 rounded-full bg-[var(--accent-primary)]/10 px-2 py-0.5 text-xs text-[var(--accent-primary)]">
                Fecha acotada
                <button type="button" onClick={() => { setFilterFrom(undefined); setFilterTo(undefined); }} className="ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="flex items-center gap-1 rounded-full bg-[var(--accent-primary)]/10 px-2 py-0.5 text-xs text-[var(--accent-primary)]">
                <Search className="h-3 w-3 shrink-0" />
                {searchQuery.length > 18 ? searchQuery.slice(0, 18) + '...' : searchQuery}
                <button type="button" onClick={() => setSearchQuery('')} className="ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Toolbar de selección */}
      {selectedEvents.size > 0 ? (
        <div className="sticky top-2 z-20 flex items-center justify-between rounded-xl border border-[var(--accent-primary)] bg-[var(--bg-secondary)] p-3 shadow-lg">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={areAllSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-[var(--text-secondary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
              id="select-all-events"
            />
            <span className="text-sm font-medium">
              {selectedEvents.size} evento{selectedEvents.size !== 1 ? 's' : ''} seleccionado{selectedEvents.size !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelectedEvents(new Set())}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteSelected}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Eliminar
            </Button>
          </div>
        </div>
      ) : (
        allEventIds.length > 0 && (
          <div className="flex items-center gap-3 px-1">
            <input
              type="checkbox"
              checked={areAllSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-[var(--text-secondary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
              id="select-all-events"
            />
            <label
              htmlFor="select-all-events"
              className="cursor-pointer select-none text-sm text-[var(--text-secondary)]"
            >
              Seleccionar todos ({allEventIds.length})
            </label>
          </div>
        )
      )}

      {/* Sección: Próximos */}
      {filterType !== 'past' && upcomingDates.length > 0 && (
        <div className="space-y-3">
          {pastDates.length > 0 && (
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-[var(--accent-primary)]" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">Próximos</span>
              <span className="rounded-full bg-[var(--accent-primary)]/10 px-2 py-0.5 text-xs text-[var(--accent-primary)]">
                {upcomingDates.reduce((sum, dk) => sum + groupedEvents[dk].events.length, 0)}
              </span>
            </div>
          )}
          <div className="space-y-3">
            {upcomingDates.map(dateKey => renderDateGroup(dateKey, false))}
          </div>
        </div>
      )}

      {/* Sección: Pasados (colapsable) */}
      {filterType !== 'upcoming' && pastDates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-[var(--text-secondary)]/15 bg-[var(--bg-secondary)]/40 px-4 py-2.5">
            <button
              type="button"
              onClick={() => setIsPastExpanded(v => !v)}
              className="flex flex-1 items-center gap-2 text-left"
            >
              {isPastExpanded
                ? <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
                : <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
              }
              <History className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">Eventos pasados</span>
              <span className="rounded-full bg-[var(--text-secondary)]/15 px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                {pastEventCount}
              </span>
            </button>
            {onDeletePastEvents && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Eliminar los ${pastEventCount} eventos que ya pasaron? Esta acción no se puede deshacer.`)) {
                    onDeletePastEvents();
                  }
                }}
                className="ml-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-red-500 transition-all hover:bg-red-100 dark:hover:bg-red-900/20"
                title="Eliminar todos los eventos pasados"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpiar pasados
              </button>
            )}
          </div>

          {isPastExpanded && (
            <div className="ml-2 space-y-3 border-l-2 border-[var(--text-secondary)]/10 pl-2">
              {pastDates.map(dateKey => renderDateGroup(dateKey, true))}
            </div>
          )}
        </div>
      )}
      {/* Estado vacío cuando los filtros no devuelven resultados */}
      {allEventIds.length === 0 && allEventsFlat.length > 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <Search className="mb-3 h-10 w-10 text-[var(--text-secondary)]/30" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">Ningún evento coincide con los filtros</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-xs text-[var(--accent-primary)] underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
};
