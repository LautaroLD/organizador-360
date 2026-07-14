import type {
  CalendarEventRow,
  CalendarOccurrence,
} from '@/types/calendarOccurrence';
import { buildOccurrenceId } from '@/types/calendarOccurrence';

export interface EventFormData {
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

interface GeneratedEvent {
  start: string;
  end: string;
}

const addDays = (dateStr: string, days: number): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  const newDay = String(date.getDate()).padStart(2, '0');
  return `${newYear}-${newMonth}-${newDay}`;
};

const getDayOfWeek = (dateStr: string): number => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
};

const isoDateOnly = (value: string) => value.split('T')[0] || value;

const splitDateAndTime = (value: string, fallbackTime: string) => {
  const [datePart, timePartRaw] = value.includes('T')
    ? value.split('T')
    : [value, fallbackTime];
  const timePart = (timePartRaw || fallbackTime).slice(0, 5);
  return {
    date: datePart,
    time: /^\d{2}:\d{2}$/.test(timePart) ? timePart : fallbackTime,
  };
};

const extractRecurrenceDays = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((day): day is string => typeof day === 'string');
};

export const generateRecurringEvents = (data: EventFormData): GeneratedEvent[] => {
  if (!data.start_date || !data.start_time || !data.end_time) {
    return [];
  }

  const startHours = parseInt(data.start_time.split(':')[0], 10);
  const startMins = parseInt(data.start_time.split(':')[1], 10);
  const endHours = parseInt(data.end_time.split(':')[0], 10);
  const endMins = parseInt(data.end_time.split(':')[1], 10);

  if (data.recurrence_type === 'none') {
    let endDate = data.start_date;
    if (endHours * 60 + endMins < startHours * 60 + startMins) {
      endDate = addDays(data.start_date, 1);
    }

    return [
      {
        start: `${data.start_date}T${String(startHours).padStart(2, '0')}:${String(startMins).padStart(2, '0')}:00`,
        end: `${endDate}T${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`,
      },
    ];
  }

  if (!data.selected_days || data.selected_days.length === 0) {
    return [];
  }

  const events: GeneratedEvent[] = [];
  let current = data.start_date;
  const recurrenceEnd = data.recurrence_end_date || data.start_date;

  while (current <= recurrenceEnd) {
    const dayOfWeek = getDayOfWeek(current);
    const dayIdMap = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const dayId = dayIdMap[dayOfWeek];

    if (dayId && data.selected_days?.includes(dayId)) {
      events.push({
        start: `${current}T${String(startHours).padStart(2, '0')}:${String(startMins).padStart(2, '0')}:00`,
        end: `${current}T${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`,
      });
    }

    current = addDays(current, 1);
  }

  return events;
};

const toOccurrenceFromRow = (
  row: CalendarEventRow,
  overrides?: Partial<CalendarOccurrence>,
): CalendarOccurrence => {
  const occurrenceStart =
    overrides?.occurrence_start ||
    row.original_start_date ||
    row.start_date;

  return {
    ...row,
    description: row.description || '',
    is_recurring: Boolean(row.is_recurring),
    recurrence_days: extractRecurrenceDays(row.recurrence_days),
    source_event_id: overrides?.source_event_id || row.id,
    occurrence_start: occurrenceStart,
    is_virtual: overrides?.is_virtual ?? false,
    ...overrides,
    id: overrides?.id || row.id,
    description: overrides?.description ?? (row.description || ''),
  };
};

/**
 * Expande un master recurrente a ocurrencias virtuales, aplicando excepciones.
 * Las excepciones canceladas se omiten; las modificadas reemplazan la ocurrencia.
 */
export function expandSeriesOccurrences(
  master: CalendarEventRow,
  exceptions: CalendarEventRow[] = [],
): CalendarOccurrence[] {
  if (!master.is_recurring) {
    return [toOccurrenceFromRow(master, { source_event_id: master.id })];
  }

  const startParts = splitDateAndTime(master.start_date, '00:00');
  const endParts = splitDateAndTime(master.end_date, '23:59');
  const selectedDays = extractRecurrenceDays(master.recurrence_days);

  const generated = generateRecurringEvents({
    title: master.title,
    description: master.description || '',
    start_date: startParts.date,
    start_time: startParts.time,
    end_date: endParts.date,
    end_time: endParts.time,
    recurrence_type:
      master.recurrence_rule === 'weekly' || master.recurrence_rule === 'custom'
        ? master.recurrence_rule
        : selectedDays.length > 0
          ? 'weekly'
          : 'none',
    selected_days: selectedDays,
    recurrence_end_date: master.recurrence_end_date || startParts.date,
  });

  const exceptionsByDate = new Map<string, CalendarEventRow>();
  for (const exception of exceptions) {
    const key = isoDateOnly(
      exception.original_start_date || exception.start_date,
    );
    exceptionsByDate.set(key, exception);
  }

  const results: CalendarOccurrence[] = [];

  for (const slot of generated) {
    const dateKey = isoDateOnly(slot.start);
    const exception = exceptionsByDate.get(dateKey);

    if (exception?.is_cancelled) {
      exceptionsByDate.delete(dateKey);
      continue;
    }

    if (exception) {
      results.push(
        toOccurrenceFromRow(exception, {
          source_event_id: master.id,
          occurrence_start: exception.original_start_date || slot.start,
          is_virtual: false,
          is_recurring: true,
          series_id: master.series_id || master.id,
          recurrence_rule: master.recurrence_rule,
          recurrence_days: extractRecurrenceDays(master.recurrence_days),
          recurrence_end_date: master.recurrence_end_date,
        }),
      );
      exceptionsByDate.delete(dateKey);
      continue;
    }

    results.push(
      toOccurrenceFromRow(master, {
        id: buildOccurrenceId(master.id, slot.start),
        start_date: slot.start,
        end_date: slot.end,
        source_event_id: master.id,
        occurrence_start: slot.start,
        is_virtual: true,
        original_start_date: slot.start,
        is_series_master: isoDateOnly(master.start_date) === dateKey,
        is_exception: false,
      }),
    );
  }

  // Excepciones fuera del rango generado (p.ej. movidas) — mostrarlas igual
  for (const orphan of exceptionsByDate.values()) {
    if (orphan.is_cancelled) continue;
    results.push(
      toOccurrenceFromRow(orphan, {
        source_event_id: master.id,
        occurrence_start: orphan.original_start_date || orphan.start_date,
        is_virtual: false,
        is_recurring: true,
      }),
    );
  }

  return results.sort((a, b) => a.start_date.localeCompare(b.start_date));
}

/**
 * Convierte filas de DB (modelo Option 3 + legado N filas) en ocurrencias de UI.
 * - Serie Option 3: 1 master (+ excepciones) → expand
 * - Serie legado: N filas materializadas → se muestran tal cual (hasta migrar)
 * - One-off: 1:1
 */
export function materializeEventsForUI(
  rows: CalendarEventRow[],
): CalendarOccurrence[] {
  const oneOffs: CalendarEventRow[] = [];
  const seriesMap = new Map<string, CalendarEventRow[]>();

  for (const row of rows) {
    if (!row.is_recurring || !row.series_id) {
      oneOffs.push(row);
      continue;
    }
    const bucket = seriesMap.get(row.series_id) || [];
    bucket.push(row);
    seriesMap.set(row.series_id, bucket);
  }

  const results: CalendarOccurrence[] = oneOffs.map((row) =>
    toOccurrenceFromRow(row, { source_event_id: row.id }),
  );

  for (const [, seriesRows] of seriesMap) {
    const master =
      seriesRows.find((row) => row.is_series_master) ||
      [...seriesRows].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

    if (!master) continue;

    const exceptions = seriesRows.filter((row) => row.is_exception);
    const nonExceptionSiblings = seriesRows.filter(
      (row) => !row.is_exception && row.id !== master.id,
    );

    // Legado: varias filas materializadas sin ser excepciones
    if (nonExceptionSiblings.length > 0) {
      for (const row of seriesRows.filter((r) => !r.is_exception)) {
        results.push(
          toOccurrenceFromRow(row, {
            source_event_id: master.id,
            occurrence_start: row.original_start_date || row.start_date,
            is_virtual: false,
          }),
        );
      }
      for (const exception of exceptions) {
        if (exception.is_cancelled) continue;
        const dateKey = isoDateOnly(
          exception.original_start_date || exception.start_date,
        );
        const alreadyShown = results.some(
          (item) =>
            item.series_id === master.series_id &&
            isoDateOnly(item.occurrence_start) === dateKey,
        );
        if (!alreadyShown) {
          results.push(
            toOccurrenceFromRow(exception, {
              source_event_id: master.id,
              occurrence_start:
                exception.original_start_date || exception.start_date,
              is_virtual: false,
            }),
          );
        }
      }
      continue;
    }

    results.push(...expandSeriesOccurrences(master, exceptions));
  }

  return results.sort((a, b) => {
    if (a.start_date === b.start_date) return a.id.localeCompare(b.id);
    return a.start_date.localeCompare(b.start_date);
  });
}
