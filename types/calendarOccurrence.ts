import type { EventEditScope } from '@/types/calendarEventEditing';

/** Fila master o excepción tal como viene de la DB / query. */
export interface CalendarEventRow {
  id: string;
  google_event_id: string | null;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  project_id: string;
  created_by: string;
  series_id?: string | null;
  is_series_master?: boolean | null;
  is_exception?: boolean | null;
  is_cancelled?: boolean | null;
  original_start_date?: string | null;
  recurrence_rule: string | null;
  recurrence_days: string[] | null;
  recurrence_end_date: string | null;
  is_recurring: boolean | null;
  creator?: {
    name: string;
    email: string;
  } | null;
}

/**
 * Ocurrencia lista para la UI.
 * - Masters/one-offs y excepciones usan el id real de DB.
 * - Ocurrencias virtuales usan `${sourceEventId}::${YYYY-MM-DD}`.
 */
export interface CalendarOccurrence
  extends Omit<
    CalendarEventRow,
    'description' | 'is_recurring' | 'creator' | 'recurrence_days'
  > {
  description: string;
  is_recurring: boolean;
  recurrence_days: string[] | null;
  creator?: {
    name: string;
    email: string;
  };
  /** Id del master (o de la fila fuente) */
  source_event_id: string;
  /** Inicio original de esta ocurrencia (para match Google instance) */
  occurrence_start: string;
  /** true si no es una fila materializada */
  is_virtual: boolean;
}

export const OCCURRENCE_ID_SEPARATOR = '::';

export function buildOccurrenceId(sourceEventId: string, occurrenceStart: string): string {
  const dateOnly = occurrenceStart.split('T')[0] || occurrenceStart;
  return `${sourceEventId}${OCCURRENCE_ID_SEPARATOR}${dateOnly}`;
}

export function parseOccurrenceId(id: string): {
  sourceEventId: string;
  occurrenceDate: string | null;
  isVirtual: boolean;
} {
  const idx = id.indexOf(OCCURRENCE_ID_SEPARATOR);
  if (idx === -1) {
    return { sourceEventId: id, occurrenceDate: null, isVirtual: false };
  }
  return {
    sourceEventId: id.slice(0, idx),
    occurrenceDate: id.slice(idx + OCCURRENCE_ID_SEPARATOR.length),
    isVirtual: true,
  };
}

export type { EventEditScope };
