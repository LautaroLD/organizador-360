import { supabaseAdmin } from '@/lib/supabase/admin';
import type {
  EventEditableFields,
  EventEditScope,
} from '@/types/calendarEventEditing';
import { parseOccurrenceId } from '@/types/calendarOccurrence';

export type EditableEventRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  google_event_id: string | null;
  is_recurring: boolean | null;
  recurrence_rule: string | null;
  recurrence_days: unknown;
  recurrence_end_date: string | null;
  series_id?: string | null;
  is_series_master?: boolean;
  is_exception?: boolean;
  is_cancelled?: boolean;
  original_start_date?: string | null;
  created_by?: string | null;
};

export const EVENT_EDITABLE_SELECT =
  'id, project_id, title, description, start_date, end_date, google_event_id, is_recurring, recurrence_rule, recurrence_days, recurrence_end_date, series_id, is_series_master, is_exception, is_cancelled, original_start_date, created_by';

export const splitDateAndTime = (value: string, fallbackTime: string) => {
  const [datePart, timePartRaw] = value.includes('T')
    ? value.split('T')
    : [value, fallbackTime];
  const timePart = (timePartRaw || fallbackTime).slice(0, 5);
  return {
    date: datePart,
    time: /^\d{2}:\d{2}$/.test(timePart) ? timePart : fallbackTime,
  };
};

export const buildDateTimeString = (date: string, time: string) =>
  `${date}T${time}:00`;

export const isoDateOnly = (value: string) => value.split('T')[0] || value;

export const addDaysToIsoDate = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0] || isoDate;
};

export const extractRecurrenceDays = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((day): day is string => typeof day === 'string');
};

export const pickSeriesMaster = (events: EditableEventRow[]) => {
  if (events.length === 0) return null;
  const explicitMaster = events.find((event) => event.is_series_master);
  if (explicitMaster) return explicitMaster;
  const sorted = [...events].sort((a, b) => {
    if (a.start_date === b.start_date) return a.id.localeCompare(b.id);
    return a.start_date.localeCompare(b.start_date);
  });
  return sorted[0] || null;
};

export const loadSeriesEvents = async (
  projectId: string,
  seriesId: string,
): Promise<EditableEventRow[]> => {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select(EVENT_EDITABLE_SELECT)
    .eq('project_id', projectId)
    .eq('series_id', seriesId)
    .order('start_date', { ascending: true });

  if (error) throw error;
  return (data || []) as EditableEventRow[];
};

export const buildEventUpdateFromChanges = (
  currentEvent: EditableEventRow,
  changes: EventEditableFields,
) => {
  const currentStart = splitDateAndTime(currentEvent.start_date, '00:00');
  const currentEnd = splitDateAndTime(currentEvent.end_date, '23:59');

  const nextStartDate = changes.start_date || currentStart.date;
  const nextStartTime = changes.start_time || currentStart.time;
  const nextEndDate = changes.end_date || currentEnd.date;
  const nextEndTime = changes.end_time || currentEnd.time;

  const nextIsRecurring =
    typeof changes.is_recurring === 'boolean'
      ? changes.is_recurring
      : currentEvent.is_recurring || false;

  const recurrenceRuleChanged = Object.prototype.hasOwnProperty.call(
    changes,
    'recurrence_rule',
  );

  const recurrenceRule = recurrenceRuleChanged
    ? changes.recurrence_rule === 'none'
      ? null
      : changes.recurrence_rule || null
    : currentEvent.recurrence_rule;

  const recurrenceDays = Array.isArray(changes.recurrence_days)
    ? changes.recurrence_days
    : currentEvent.recurrence_days;

  const recurrenceEndDate = Object.prototype.hasOwnProperty.call(
    changes,
    'recurrence_end_date',
  )
    ? changes.recurrence_end_date || null
    : currentEvent.recurrence_end_date;

  return {
    title: changes.title ?? currentEvent.title,
    description: changes.description ?? currentEvent.description,
    start_date: buildDateTimeString(nextStartDate, nextStartTime),
    end_date: buildDateTimeString(nextEndDate, nextEndTime),
    is_recurring: nextIsRecurring,
    recurrence_rule: nextIsRecurring ? recurrenceRule : null,
    recurrence_days: nextIsRecurring ? recurrenceDays : null,
    recurrence_end_date: nextIsRecurring ? recurrenceEndDate : null,
  };
};

export const didEventTimesChange = (
  before: Pick<EditableEventRow, 'start_date' | 'end_date'>,
  after: Pick<EditableEventRow, 'start_date' | 'end_date'>,
) => {
  const beforeStart = splitDateAndTime(before.start_date, '00:00');
  const beforeEnd = splitDateAndTime(before.end_date, '23:59');
  const afterStart = splitDateAndTime(after.start_date, '00:00');
  const afterEnd = splitDateAndTime(after.end_date, '23:59');

  return (
    beforeStart.date !== afterStart.date ||
    beforeStart.time !== afterStart.time ||
    beforeEnd.date !== afterEnd.date ||
    beforeEnd.time !== afterEnd.time
  );
};

export const didRecurrencePatternChange = (
  before: EditableEventRow,
  changes: EventEditableFields,
) => {
  if (Object.prototype.hasOwnProperty.call(changes, 'recurrence_rule')) {
    const nextRule =
      changes.recurrence_rule === 'none' ? null : changes.recurrence_rule || null;
    if (nextRule !== before.recurrence_rule) return true;
  }

  if (Array.isArray(changes.recurrence_days)) {
    const beforeDays = extractRecurrenceDays(before.recurrence_days)
      .slice()
      .sort();
    const nextDays = changes.recurrence_days.slice().sort();
    if (beforeDays.join(',') !== nextDays.join(',')) return true;
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'recurrence_end_date')) {
    const beforeEnd = before.recurrence_end_date || null;
    const nextEnd = changes.recurrence_end_date || null;
    if (beforeEnd !== nextEnd) return true;
  }

  return false;
};

export type SeriesEditContext = {
  scope: EventEditScope;
  master: EditableEventRow;
  /** Ocurrencia clickeada (master virtual o excepción existente) */
  occurrenceStart: string;
  /** Fila a tocar en Google single (excepción o proyección del master) */
  targetForSingle: EditableEventRow;
  /** Filas actualizadas / creadas para respuesta */
  updatedEvents: EditableEventRow[];
  /** Serie vieja truncada (this_and_following) */
  oldMasterGoogleEventId: string | null;
  splitPivotDateOnly: string | null;
  /** true si se creó un master nuevo */
  createdNewSeries: boolean;
  timesChanged: boolean;
};

/**
 * Resuelve master + occurrenceStart a partir del eventId (real o virtual `id::date`).
 */
export async function resolveEditTarget(params: {
  eventId: string;
  projectId: string;
  occurrenceStart?: string | null;
}): Promise<{
  master: EditableEventRow;
  occurrenceStart: string;
  existingException: EditableEventRow | null;
  clickedRow: EditableEventRow;
}> {
  const parsed = parseOccurrenceId(params.eventId);
  const sourceId = parsed.sourceEventId;

  const { data: found, error } = await supabaseAdmin
    .from('events')
    .select(EVENT_EDITABLE_SELECT)
    .eq('id', sourceId)
    .maybeSingle();

  if (error) throw error;
  if (!found) {
    throw Object.assign(new Error('Evento no encontrado'), { status: 404 });
  }

  const clickedRow = found as EditableEventRow;
  if (clickedRow.project_id !== params.projectId) {
    throw Object.assign(new Error('eventId no pertenece al projectId indicado'), {
      status: 400,
    });
  }

  const seriesId = clickedRow.series_id || clickedRow.id;
  const seriesRows = clickedRow.is_recurring
    ? await loadSeriesEvents(params.projectId, seriesId)
    : [clickedRow];

  const master =
    pickSeriesMaster(seriesRows.filter((r) => !r.is_exception)) ||
    pickSeriesMaster(seriesRows) ||
    clickedRow;

  const masterStart = splitDateAndTime(master.start_date, '00:00');
  let occurrenceStart =
    params.occurrenceStart ||
    (parsed.occurrenceDate
      ? buildDateTimeString(parsed.occurrenceDate, masterStart.time)
      : null) ||
    clickedRow.original_start_date ||
    clickedRow.start_date;

  if (clickedRow.is_exception && clickedRow.original_start_date) {
    occurrenceStart = clickedRow.original_start_date;
  }

  const occurrenceDate = isoDateOnly(occurrenceStart);
  const existingException =
    seriesRows.find(
      (row) =>
        row.is_exception &&
        isoDateOnly(row.original_start_date || row.start_date) ===
          occurrenceDate,
    ) || null;

  return {
    master,
    occurrenceStart,
    existingException,
    clickedRow,
  };
}

/** Aplica edición Option 3 (1 master + excepciones) en la DB local. */
export async function applySeriesEditLocally(params: {
  scope: EventEditScope;
  projectId: string;
  userId: string;
  master: EditableEventRow;
  occurrenceStart: string;
  existingException: EditableEventRow | null;
  changes: EventEditableFields;
}): Promise<SeriesEditContext> {
  const {
    scope,
    projectId,
    userId,
    master,
    occurrenceStart,
    existingException,
    changes,
  } = params;

  const occurrenceDate = isoDateOnly(occurrenceStart);
  const masterStart = splitDateAndTime(master.start_date, '00:00');
  const masterEnd = splitDateAndTime(master.end_date, '23:59');

  // Snapshot "antes" de la ocurrencia clickeada (hora del master o de la excepción)
  const beforeOccurrence: EditableEventRow = existingException || {
    ...master,
    start_date: buildDateTimeString(occurrenceDate, masterStart.time),
    end_date: buildDateTimeString(occurrenceDate, masterEnd.time),
    original_start_date: occurrenceStart,
  };

  if (scope === 'single') {
    const updateFields = buildEventUpdateFromChanges(beforeOccurrence, changes);
    const timesChanged = didEventTimesChange(beforeOccurrence, {
      start_date: updateFields.start_date,
      end_date: updateFields.end_date,
    });

    // Primer ocurrencia + single sin excepción previa y mismos datos de serie:
    // si es exactamente el start del master y no hay exception, actualizar master
    // solo cuando es one-off; para recurrentes siempre excepción (salvo que sea
    // la única forma de no romper RRULE — usamos excepción siempre en recurrentes).
    if (!master.is_recurring) {
      const { data, error } = await supabaseAdmin
        .from('events')
        .update(updateFields)
        .eq('id', master.id)
        .select(EVENT_EDITABLE_SELECT)
        .single();
      if (error) throw error;
      const updated = data as EditableEventRow;
      return {
        scope,
        master: updated,
        occurrenceStart,
        targetForSingle: updated,
        updatedEvents: [updated],
        oldMasterGoogleEventId: master.google_event_id,
        splitPivotDateOnly: null,
        createdNewSeries: false,
        timesChanged,
      };
    }

    const exceptionPayload = {
      ...updateFields,
      project_id: projectId,
      created_by: existingException?.created_by || userId,
      series_id: master.series_id || master.id,
      is_series_master: false,
      is_exception: true,
      is_cancelled: false,
      is_recurring: true,
      // Excepción no lleva RRULE propia
      recurrence_rule: null,
      recurrence_days: null,
      recurrence_end_date: null,
      original_start_date: occurrenceStart,
      google_event_id: existingException?.google_event_id || null,
    };

    let saved: EditableEventRow;
    if (existingException) {
      const { data, error } = await supabaseAdmin
        .from('events')
        .update(exceptionPayload)
        .eq('id', existingException.id)
        .select(EVENT_EDITABLE_SELECT)
        .single();
      if (error) throw error;
      saved = data as EditableEventRow;
    } else {
      const { data, error } = await supabaseAdmin
        .from('events')
        .insert(exceptionPayload)
        .select(EVENT_EDITABLE_SELECT)
        .single();
      if (error) throw error;
      saved = data as EditableEventRow;
    }

    return {
      scope,
      master,
      occurrenceStart,
      targetForSingle: saved,
      updatedEvents: [saved],
      oldMasterGoogleEventId: master.google_event_id,
      splitPivotDateOnly: null,
      createdNewSeries: false,
      timesChanged,
    };
  }

  if (scope === 'all') {
    if (!master.is_recurring) {
      throw Object.assign(
        new Error('El scope solicitado requiere una serie recurrente existente.'),
        { status: 400 },
      );
    }

    const updateFields = buildEventUpdateFromChanges(master, changes);
    // En "all", el form trae la fecha de la ocurrencia clickeada; conservar
    // la fecha ancla del master y solo aplicar hora / metadatos / recurrencia.
    const nextStart = splitDateAndTime(updateFields.start_date, masterStart.time);
    const nextEnd = splitDateAndTime(updateFields.end_date, masterEnd.time);
    updateFields.start_date = buildDateTimeString(masterStart.date, nextStart.time);
    updateFields.end_date = buildDateTimeString(masterStart.date, nextEnd.time);

    const timesChanged = didEventTimesChange(master, updateFields);

    const { data, error } = await supabaseAdmin
      .from('events')
      .update(updateFields)
      .eq('id', master.id)
      .select(EVENT_EDITABLE_SELECT)
      .single();
    if (error) throw error;
    const updated = data as EditableEventRow;

    return {
      scope,
      master: updated,
      occurrenceStart,
      targetForSingle: updated,
      updatedEvents: [updated],
      oldMasterGoogleEventId: master.google_event_id,
      splitPivotDateOnly: null,
      createdNewSeries: false,
      timesChanged,
    };
  }

  // this_and_following: truncar master + crear nueva serie desde el pivot
  if (!master.is_recurring) {
    throw Object.assign(
      new Error('El scope solicitado requiere una serie recurrente existente.'),
      { status: 400 },
    );
  }

  const pivotDateOnly = occurrenceDate;
  const previousDate = addDaysToIsoDate(pivotDateOnly, -1);
  const isFromFirstOccurrence = pivotDateOnly <= masterStart.date;

  if (isFromFirstOccurrence) {
    // Equivale a editar toda la serie
    const updateFields = buildEventUpdateFromChanges(master, changes);
    const timesChanged = didEventTimesChange(master, updateFields);
    const { data, error } = await supabaseAdmin
      .from('events')
      .update(updateFields)
      .eq('id', master.id)
      .select(EVENT_EDITABLE_SELECT)
      .single();
    if (error) throw error;
    const updated = data as EditableEventRow;
    return {
      scope: 'all',
      master: updated,
      occurrenceStart,
      targetForSingle: updated,
      updatedEvents: [updated],
      oldMasterGoogleEventId: master.google_event_id,
      splitPivotDateOnly: null,
      createdNewSeries: false,
      timesChanged,
    };
  }

  const { error: truncateError } = await supabaseAdmin
    .from('events')
    .update({ recurrence_end_date: previousDate })
    .eq('id', master.id);
  if (truncateError) throw truncateError;

  // Cancelar / mover excepciones desde el pivot a la serie nueva se deja
  // fuera: las excepciones futuras quedan huérfanas del master viejo; las
  // borramos del rango pivot+ para no duplicar en UI.
  const seriesId = master.series_id || master.id;
  const seriesRows = await loadSeriesEvents(projectId, seriesId);
  const futureExceptions = seriesRows.filter(
    (row) =>
      row.is_exception &&
      isoDateOnly(row.original_start_date || row.start_date) >= pivotDateOnly,
  );
  if (futureExceptions.length > 0) {
    await supabaseAdmin
      .from('events')
      .delete()
      .in(
        'id',
        futureExceptions.map((row) => row.id),
      );
  }

  const pivotBase: EditableEventRow = {
    ...master,
    start_date: buildDateTimeString(pivotDateOnly, masterStart.time),
    end_date: buildDateTimeString(pivotDateOnly, masterEnd.time),
    original_start_date: occurrenceStart,
  };
  const newMasterFields = buildEventUpdateFromChanges(pivotBase, changes);
  const timesChanged = didEventTimesChange(pivotBase, newMasterFields);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('events')
    .insert({
      ...newMasterFields,
      project_id: projectId,
      created_by: master.created_by || userId,
      is_series_master: true,
      is_exception: false,
      is_cancelled: false,
      is_recurring: true,
      original_start_date: newMasterFields.start_date,
      google_event_id: null,
      series_id: null,
    })
    .select(EVENT_EDITABLE_SELECT)
    .single();
  if (insertError) throw insertError;

  let newMaster = inserted as EditableEventRow;
  const { data: linked, error: linkError } = await supabaseAdmin
    .from('events')
    .update({ series_id: newMaster.id })
    .eq('id', newMaster.id)
    .select(EVENT_EDITABLE_SELECT)
    .single();
  if (linkError) throw linkError;
  newMaster = linked as EditableEventRow;

  return {
    scope,
    master: newMaster,
    occurrenceStart,
    targetForSingle: newMaster,
    updatedEvents: [newMaster],
    oldMasterGoogleEventId: master.google_event_id,
    splitPivotDateOnly: pivotDateOnly,
    createdNewSeries: true,
    timesChanged,
  };
}
