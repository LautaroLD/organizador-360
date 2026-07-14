// API Routes para sincronización con Google Calendar
import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/googleCalendar';
import {
  applyUntilToRecurrence,
  attachGoogleEventLinkMetadata,
  formatEventForGoogle,
  GOOGLE_EVENT_PRIVATE_PROPERTIES,
} from '@/lib/googleCalendarUtils';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';
import {
  EditCalendarEventRequest,
  EventEditableFields,
} from '@/types/calendarEventEditing';

import { calendar_v3 } from 'googleapis';

type GoogleTokenRow = {
  user_id?: string | null;
  access_token: string;
  refresh_token: string;
  scope?: string | null;
  token_type?: string | null;
  expires_at?: string | null;
};

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

type SessionIdentity = {
  provider?: string;
};

type AuthSessionLike = {
  provider_token?: string | null;
  provider_refresh_token?: string | null;
  user?: {
    app_metadata?: {
      provider?: string;
    };
    identities?: SessionIdentity[];
  };
};

interface SyncEventPayload {
  id?: string;
  project_id?: string;
  google_event_id?: string | null;
  title: string;
  start_date: string;
  [key: string]: unknown;
}

type EditableEventRow = {
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
  original_start_date?: string | null;
};

type LocalEventLink = {
  id: string;
  project_id: string;
  google_event_id: string | null;
};

type SyncGoogleAction = 'created' | 'updated' | 'linked' | 'skipped';

type SyncGoogleResult = {
  action: SyncGoogleAction;
  data?: calendar_v3.Schema$Event;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const normalizeTitle = (title: string) => title.trim().toLowerCase();

const getEventStartDate = (event: calendar_v3.Schema$Event): string | null => {
  const dateTime = event.start?.dateTime;
  if (dateTime) {
    return dateTime.split('T')[0] || null;
  }

  return event.start?.date || null;
};

const buildEventSignature = (title: string, startDate: string) => {
  return `${normalizeTitle(title)}|${startDate}`;
};

const getPayloadStartDate = (event: SyncEventPayload) => {
  return event.start_date.split('T')[0] || event.start_date;
};

const splitDateAndTime = (value: string, fallbackTime: string) => {
  const raw = (value || '').trim();
  const [datePartRaw, timePartRaw = ''] = raw.includes('T')
    ? raw.split('T')
    : [raw, fallbackTime];

  const datePart = (datePartRaw || '').slice(0, 10);
  const cleanedTime = timePartRaw
    .replace(/\.\d+/, '')
    .replace(/(Z|[+-]\d{2}:?\d{2})$/i, '');
  const timePart = cleanedTime.slice(0, 5);

  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : datePartRaw,
    time: /^\d{2}:\d{2}$/.test(timePart) ? timePart : fallbackTime,
  };
};

const buildDateTimeString = (date: string, time: string) =>
  `${date}T${time}:00`;

const EVENT_EDITABLE_SELECT =
  'id, project_id, title, description, start_date, end_date, google_event_id, is_recurring, recurrence_rule, recurrence_days, recurrence_end_date, series_id, is_series_master, is_exception, original_start_date';

const extractRecurrenceDays = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((day): day is string => typeof day === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((day): day is string => typeof day === 'string');
      }
    } catch {
      return value
        .split(',')
        .map((day) => day.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const isoDateOnly = (value: string) => value.split('T')[0] || value;

const addDaysToIsoDate = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0] || isoDate;
};

const daysDiffBetweenIsoDates = (fromDate: string, toDate: string) => {
  const from = new Date(`${fromDate}T00:00:00Z`).getTime();
  const to = new Date(`${toDate}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86400000);
};

const buildEventUpdateFromChanges = (
  currentEvent: EditableEventRow,
  changes: EventEditableFields,
  scope: 'single' | 'all' | 'this_and_following',
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

  const shouldMarkException =
    scope === 'single' &&
    Boolean(currentEvent.series_id) &&
    currentEvent.is_series_master !== true;

  return {
    title: changes.title ?? currentEvent.title,
    description: changes.description ?? currentEvent.description,
    start_date: buildDateTimeString(nextStartDate, nextStartTime),
    end_date: buildDateTimeString(nextEndDate, nextEndTime),
    is_recurring: nextIsRecurring,
    recurrence_rule: nextIsRecurring ? recurrenceRule : null,
    recurrence_days: nextIsRecurring ? recurrenceDays : null,
    recurrence_end_date: nextIsRecurring ? recurrenceEndDate : null,
    is_exception: shouldMarkException ? true : currentEvent.is_exception,
    original_start_date:
      currentEvent.original_start_date || currentEvent.start_date || null,
  };
};

const toSyncPayloadFromEvent = (event: EditableEventRow): SyncEventPayload => {
  const start = splitDateAndTime(event.start_date, '00:00');
  const end = splitDateAndTime(event.end_date, '23:59');

  return {
    id: event.id,
    project_id: event.project_id,
    google_event_id: event.google_event_id,
    title: event.title,
    description: event.description || '',
    start_date: start.date,
    start_time: start.time,
    end_date: end.date,
    end_time: end.time,
    is_recurring: event.is_recurring || false,
    recurrence_rule: event.recurrence_rule,
    selected_days: extractRecurrenceDays(event.recurrence_days),
    recurrence_end_date: event.recurrence_end_date || undefined,
  };
};

const pickSeriesMaster = (events: EditableEventRow[]) => {
  if (events.length === 0) return null;
  const explicitMaster = events.find((event) => event.is_series_master);
  if (explicitMaster) return explicitMaster;

  const sorted = [...events].sort((a, b) => {
    if (a.start_date === b.start_date) {
      return a.id.localeCompare(b.id);
    }
    return a.start_date.localeCompare(b.start_date);
  });

  return sorted[0] || null;
};

const findDuplicateGoogleEvent = (
  existingEvents: calendar_v3.Schema$Event[],
  event: SyncEventPayload,
) => {
  const eventSignature = buildEventSignature(
    event.title,
    getPayloadStartDate(event),
  );

  return (
    existingEvents.find((googleEvent: calendar_v3.Schema$Event) => {
      const title = googleEvent.summary;
      const startDate = getEventStartDate(googleEvent);
      if (!title || !startDate) return false;
      return buildEventSignature(title, startDate) === eventSignature;
    }) || null
  );
};

const getGoogleErrorStatus = (error: unknown) => {
  const err = error as {
    code?: number;
    response?: {
      status?: number;
      data?: {
        code?: number;
      };
    };
  };

  return (
    err?.response?.status || err?.response?.data?.code || err?.code || null
  );
};

const isGoogleNotFoundError = (error: unknown) => {
  const status = getGoogleErrorStatus(error);
  return status === 404 || status === 410;
};

const toGoogleTokens = (row: GoogleTokenRow): GoogleTokens => ({
  access_token: row.access_token,
  refresh_token: row.refresh_token,
  scope: row.scope || 'https://www.googleapis.com/auth/calendar',
  token_type: row.token_type || 'Bearer',
  expiry_date: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
});

const getAuthenticatedUser = async () => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null as null, session: null as null };
  }

  return { supabase, user, session };
};

const ensureProGoogleAccess = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) => {
  const canUseGoogleCalendar = await canUseAIFeatures(supabase, userId);
  if (!canUseGoogleCalendar) {
    throw new HttpError(
      403,
      'La sincronización con Google Calendar está disponible solo para plan Pro',
    );
  }
};

const getSessionGoogleTokens = (
  session: AuthSessionLike | null,
): GoogleTokens | null => {
  if (!session?.provider_token) {
    return null;
  }

  const provider = session.user?.app_metadata?.provider;
  const identities = session.user?.identities || [];
  const hasGoogleIdentity = identities.some(
    (identity) => identity.provider === 'google',
  );

  if (provider !== 'google' && !hasGoogleIdentity) {
    return null;
  }

  return {
    access_token: session.provider_token,
    refresh_token: session.provider_refresh_token || undefined,
    scope:
      'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    token_type: 'Bearer',
  };
};

const getUserGoogleTokens = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return toGoogleTokens(data);
};

const userHasProjectAccess = async (projectId: string, userId: string) => {
  const [
    { data: project, error: projectError },
    { data: membership, error: memberError },
  ] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .maybeSingle(),
    supabaseAdmin
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (projectError) throw projectError;
  if (memberError && memberError.code !== 'PGRST116') throw memberError;

  if (!project) return false;
  return project.owner_id === userId || Boolean(membership);
};

const userCanEditProjectEvents = async (projectId: string, userId: string) => {
  const [
    { data: project, error: projectError },
    { data: membership, error: memberError },
  ] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .maybeSingle(),
    supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (projectError) throw projectError;
  if (memberError && memberError.code !== 'PGRST116') throw memberError;
  if (!project) return false;

  if (project.owner_id === userId) return true;

  const role =
    typeof membership?.role === 'string' ? membership.role.toLowerCase() : null;

  return role === 'owner' || role === 'admin';
};

const getLocalEventLink = async (
  event: SyncEventPayload,
  userId: string,
): Promise<LocalEventLink | null> => {
  if (!event.id) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('events')
    .select('id, project_id, google_event_id')
    .eq('id', event.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new HttpError(404, 'Evento local no encontrado');

  const hasAccess = await userHasProjectAccess(data.project_id, userId);
  if (!hasAccess) throw new HttpError(403, 'Forbidden');

  return {
    id: data.id,
    project_id: data.project_id,
    google_event_id: data.google_event_id,
  };
};

const buildLinkedGoogleEvent = (
  event: SyncEventPayload,
  localEvent: LocalEventLink | null,
  options?: { asException?: boolean },
) => {
  const linkedEvent = {
    ...event,
    id: localEvent?.id || event.id,
    project_id: localEvent?.project_id || event.project_id,
    google_event_id: localEvent?.google_event_id || event.google_event_id,
  };

  return attachGoogleEventLinkMetadata(
    formatEventForGoogle(linkedEvent, {
      asException: options?.asException,
    }),
    linkedEvent,
  );
};

const persistGoogleEventId = async (
  localEvent: LocalEventLink | null,
  googleEventId?: string | null,
) => {
  if (!localEvent?.id || !googleEventId) return;
  if (localEvent.google_event_id === googleEventId) return;

  const { error } = await supabaseAdmin
    .from('events')
    .update({ google_event_id: googleEventId })
    .eq('id', localEvent.id);

  if (error) throw error;
  localEvent.google_event_id = googleEventId;
};

const loadSeriesEvents = async (
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

/** Resuelve el google_event_id del master de la serie (u otra fila que ya lo tenga). */
const resolveSeriesGoogleMaster = async (
  event: EditableEventRow,
): Promise<EditableEventRow | null> => {
  const seriesId = event.series_id || event.id;
  const seriesEvents = await loadSeriesEvents(event.project_id, seriesId);
  if (seriesEvents.length === 0) {
    return event.google_event_id ? event : null;
  }

  const master = pickSeriesMaster(seriesEvents);
  if (master?.google_event_id) return master;

  const linked = seriesEvents.find((row) => Boolean(row.google_event_id));
  return linked || master || null;
};

const matchGoogleInstanceByOriginalDate = (
  instances: calendar_v3.Schema$Event[],
  originalStartDate: string,
) => {
  const targetDate = isoDateOnly(originalStartDate);

  return (
    instances.find((instance) => {
      const candidate =
        instance.originalStartTime?.dateTime ||
        instance.originalStartTime?.date ||
        instance.start?.dateTime ||
        instance.start?.date ||
        null;
      return candidate ? isoDateOnly(candidate) === targetDate : false;
    }) || null
  );
};

const didEventTimesChange = (
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

const didRecurrencePatternChange = (
  before: EditableEventRow,
  changes: EventEditableFields,
) => {
  if (Object.prototype.hasOwnProperty.call(changes, 'recurrence_rule')) {
    const nextRule =
      changes.recurrence_rule === 'none' ? null : changes.recurrence_rule || null;
    if (nextRule !== before.recurrence_rule) return true;
  }

  if (Array.isArray(changes.recurrence_days)) {
    const beforeDays = extractRecurrenceDays(before.recurrence_days).slice().sort();
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

const findRecurringInstanceForLocalEvent = async (
  calendarService: GoogleCalendarService,
  recurringEventId: string,
  originalStartDate: string,
) => {
  const dateOnly = isoDateOnly(originalStartDate);
  const timeMin = `${dateOnly}T00:00:00Z`;
  const timeMax = `${addDaysToIsoDate(dateOnly, 1)}T00:00:00Z`;

  const instances = await calendarService.listEventInstances(recurringEventId, {
    timeMin,
    timeMax,
    maxResults: 20,
  });

  return matchGoogleInstanceByOriginalDate(instances, originalStartDate);
};

const truncateGoogleRecurringSeries = async (
  calendarService: GoogleCalendarService,
  recurringEventId: string,
  untilDate: string,
  timeZone: string,
) => {
  const existing = await calendarService.getEvent(recurringEventId);
  const recurrence = applyUntilToRecurrence(
    existing.recurrence,
    untilDate,
    timeZone,
  );

  return calendarService.patchEvent(recurringEventId, { recurrence });
};

const resolveGoogleTimeZone = (
  googleEvent: calendar_v3.Schema$Event | null | undefined,
  fallback: string,
) => {
  return (
    googleEvent?.start?.timeZone ||
    googleEvent?.originalStartTime?.timeZone ||
    fallback ||
    'UTC'
  );
};

const syncSingleOccurrenceToGoogle = async ({
  calendarService,
  event,
  originalStartDate,
  seriesMasterGoogleEventId,
  seriesMasterLocalId,
  userId,
  timesChanged,
  timeZone,
}: {
  calendarService: GoogleCalendarService;
  event: EditableEventRow;
  originalStartDate: string;
  seriesMasterGoogleEventId: string | null;
  seriesMasterLocalId: string | null;
  userId: string;
  timesChanged: boolean;
  timeZone: string;
}): Promise<SyncGoogleResult | null> => {
  const localEvent = await getLocalEventLink(toSyncPayloadFromEvent(event), userId);
  const payload = {
    ...toSyncPayloadFromEvent(event),
    time_zone: timeZone,
  };
  const exceptionBody = buildLinkedGoogleEvent(payload, localEvent, {
    asException: true,
  });

  const ownGoogleId = localEvent?.google_event_id || event.google_event_id;
  const isSeriesMasterRow =
    Boolean(seriesMasterLocalId) && localEvent?.id === seriesMasterLocalId;
  const isOwnExceptionInstance =
    Boolean(ownGoogleId) &&
    ownGoogleId !== seriesMasterGoogleEventId &&
    !isSeriesMasterRow;

  const buildExceptionPatch = (googleSource?: calendar_v3.Schema$Event | null) => {
    const patch: calendar_v3.Schema$Event = {
      summary: exceptionBody.summary,
      description: exceptionBody.description,
      extendedProperties: exceptionBody.extendedProperties,
    };

    // Solo tocar start/end si la hora/fecha local cambió; si no, Google
    // reinterpreta el dateTime+timeZone y produce desfases.
    if (timesChanged) {
      const tz = resolveGoogleTimeZone(googleSource, timeZone);
      patch.start = {
        dateTime: exceptionBody.start.dateTime,
        timeZone: tz,
      };
      patch.end = {
        dateTime: exceptionBody.end.dateTime,
        timeZone: tz,
      };
    }

    return patch;
  };

  if (isOwnExceptionInstance && ownGoogleId) {
    let existing: calendar_v3.Schema$Event | null = null;
    try {
      existing = await calendarService.getEvent(ownGoogleId);
    } catch (error) {
      if (!isGoogleNotFoundError(error)) throw error;
    }

    const updated = await calendarService.patchEvent(
      ownGoogleId,
      buildExceptionPatch(existing),
    );
    await persistGoogleEventId(localEvent, updated.id || ownGoogleId);
    return { action: 'updated', data: updated };
  }

  if (!seriesMasterGoogleEventId) {
    return null;
  }

  const instance = await findRecurringInstanceForLocalEvent(
    calendarService,
    seriesMasterGoogleEventId,
    originalStartDate,
  );

  if (!instance?.id) {
    return null;
  }

  const updated = await calendarService.patchEvent(
    instance.id,
    buildExceptionPatch(instance),
  );

  // Nunca sobrescribir el google_event_id del master de la serie con el de una
  // instancia; solo persistir el id de excepción en ocurrencias no-master.
  if (!isSeriesMasterRow) {
    await persistGoogleEventId(localEvent, updated.id || instance.id);
  }

  return { action: 'updated', data: updated };
};

const syncEventWithGoogle = async ({
  calendarService,
  event,
  userId,
  checkDuplicate,
  existingEvents,
}: {
  calendarService: GoogleCalendarService;
  event: SyncEventPayload;
  userId: string;
  checkDuplicate: boolean;
  existingEvents?: calendar_v3.Schema$Event[];
}): Promise<SyncGoogleResult> => {
  const localEvent = await getLocalEventLink(event, userId);
  const googleEvent = buildLinkedGoogleEvent(event, localEvent);
  const linkedLocalEventId = localEvent?.id || event.id;
  const knownGoogleEventId =
    localEvent?.google_event_id || event.google_event_id || null;

  if (knownGoogleEventId) {
    try {
      const updated = await calendarService.updateEvent(
        knownGoogleEventId,
        googleEvent,
      );
      await persistGoogleEventId(localEvent, updated.id || knownGoogleEventId);
      return { action: 'updated', data: updated };
    } catch (error) {
      if (!isGoogleNotFoundError(error)) throw error;
    }
  }

  if (linkedLocalEventId) {
    const linkedGoogleEvent = await calendarService.findEventByPrivateProperty(
      GOOGLE_EVENT_PRIVATE_PROPERTIES.appEventId,
      linkedLocalEventId,
    );

    if (linkedGoogleEvent?.id) {
      const updated = await calendarService.updateEvent(
        linkedGoogleEvent.id,
        googleEvent,
      );
      await persistGoogleEventId(
        localEvent,
        updated.id || linkedGoogleEvent.id,
      );
      return { action: 'updated', data: updated };
    }
  }

  if (checkDuplicate) {
    const candidateEvents =
      existingEvents || (await calendarService.getEvents());
    const duplicate = findDuplicateGoogleEvent(candidateEvents, event);

    if (duplicate?.id) {
      if (linkedLocalEventId) {
        const updated = await calendarService.updateEvent(
          duplicate.id,
          googleEvent,
        );
        await persistGoogleEventId(localEvent, updated.id || duplicate.id);
        return { action: 'linked', data: updated };
      }

      return { action: 'skipped', data: duplicate };
    }
  }

  const created = await calendarService.createEvent(googleEvent);
  await persistGoogleEventId(localEvent, created.id);
  return { action: 'created', data: created };
};

const deleteGoogleEventForSource = async ({
  tokens,
  googleEventId,
  eventId,
  eventTitle,
  startDate,
}: {
  tokens: GoogleTokens;
  googleEventId?: string | null;
  eventId?: string | null;
  eventTitle?: string;
  startDate?: string;
}) => {
  const calendarService = new GoogleCalendarService(tokens);

  if (googleEventId) {
    try {
      await calendarService.deleteEvent(googleEventId);
      return 1;
    } catch (error) {
      if (!isGoogleNotFoundError(error)) throw error;
    }
  }

  if (eventId) {
    const linkedGoogleEvent = await calendarService.findEventByPrivateProperty(
      GOOGLE_EVENT_PRIVATE_PROPERTIES.appEventId,
      eventId,
    );

    if (linkedGoogleEvent?.id) {
      await calendarService.deleteEvent(linkedGoogleEvent.id);
      return 1;
    }
  }

  if (!eventTitle || !startDate) {
    return 0;
  }

  const events = await calendarService.getEvents();
  const matchingEvents = events.filter(
    (event: calendar_v3.Schema$Event) =>
      normalizeTitle(event.summary || '') === normalizeTitle(eventTitle) &&
      getEventStartDate(event) === startDate,
  );

  let deleted = 0;
  for (const event of matchingEvents) {
    if (!event?.id) continue;
    await calendarService.deleteEvent(event.id);
    deleted += 1;
  }

  return deleted;
};

const getProjectGoogleTokens = async (projectId: string) => {
  const userIds = new Set<string>();

  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError) throw projectError;
  if (project?.owner_id) {
    userIds.add(project.owner_id);
  }

  const { data: members, error: membersError } = await supabaseAdmin
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId);

  if (membersError) throw membersError;
  members?.forEach((member) => {
    if (member?.user_id) userIds.add(member.user_id);
  });

  if (userIds.size === 0) return [];

  const { data: tokenRows, error: tokensError } = await supabaseAdmin
    .from('google_calendar_tokens')
    .select('*')
    .in('user_id', Array.from(userIds));

  if (tokensError) throw tokensError;
  return tokenRows || [];
};

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, session } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureProGoogleAccess(supabase, user.id);

    const body = await request.json();
    const {
      event,
      events,
      checkDuplicate = false,
    } = body as {
      event?: SyncEventPayload;
      events?: SyncEventPayload[];
      checkDuplicate?: boolean;
    };

    const storedTokens = await getUserGoogleTokens(user.id);
    const sessionTokens = getSessionGoogleTokens(
      (session as AuthSessionLike | null) || null,
    );
    const tokens = storedTokens || sessionTokens;

    if (!tokens) {
      return NextResponse.json(
        { error: 'Google Calendar no conectado' },
        { status: 401 },
      );
    }

    const calendarService = new GoogleCalendarService(tokens);

    // Sincronizacion en lote
    if (Array.isArray(events)) {
      if (events.length === 0) {
        return NextResponse.json({
          success: true,
          created: 0,
          updated: 0,
          linked: 0,
          skipped: 0,
          errors: 0,
        });
      }

      const existingEvents = checkDuplicate
        ? await calendarService.getEvents()
        : undefined;

      let created = 0;
      let updated = 0;
      let linked = 0;
      let skipped = 0;
      let errors = 0;

      for (const currentEvent of events) {
        try {
          const result = await syncEventWithGoogle({
            calendarService,
            event: currentEvent,
            userId: user.id,
            checkDuplicate,
            existingEvents,
          });

          if (result.action === 'created') created += 1;
          if (result.action === 'updated') updated += 1;
          if (result.action === 'linked') linked += 1;
          if (result.action === 'skipped') skipped += 1;

          if (existingEvents && result.data) {
            existingEvents.push(result.data);
          }
        } catch (batchError) {
          errors += 1;
          console.error('Error al sincronizar evento en lote:', batchError);
        }
      }

      return NextResponse.json({
        success: errors === 0,
        partial: errors > 0,
        created,
        updated,
        linked,
        skipped,
        errors,
      });
    }

    if (!event) {
      return NextResponse.json(
        { error: 'No event payload provided' },
        { status: 400 },
      );
    }

    const result = await syncEventWithGoogle({
      calendarService,
      event,
      userId: user.id,
      checkDuplicate,
    });

    return NextResponse.json({
      success: true,
      skipped: result.action === 'skipped',
      action: result.action,
      google_event_id: result.data?.id || null,
      data: result.data,
    });
  } catch (error: unknown) {
    console.error('Error al sincronizar evento:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Error al sincronizar evento';
    const status = error instanceof HttpError ? error.status : 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}

export { PATCH } from './patchHandler';

// Obtener eventos de Google Calendar
export async function GET() {
  try {
    const { supabase, user, session } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureProGoogleAccess(supabase, user.id);

    const storedTokens = await getUserGoogleTokens(user.id);
    const sessionTokens = getSessionGoogleTokens(
      (session as AuthSessionLike | null) || null,
    );
    const tokens = storedTokens || sessionTokens;

    if (!tokens) {
      return NextResponse.json(
        { error: 'Google Calendar no conectado' },
        { status: 401 },
      );
    }

    const calendarService = new GoogleCalendarService(tokens);
    const events = await calendarService.getEvents();

    return NextResponse.json({ success: true, data: events });
  } catch (error: unknown) {
    console.error('Error al obtener eventos:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Error al obtener eventos';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Eliminar evento de Google Calendar
export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user, session } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureProGoogleAccess(supabase, user.id);

    const body = await request.json();
    const { eventTitle, startDate, projectId, googleEventId, eventId } =
      body as {
        eventTitle?: string;
        startDate?: string;
        projectId?: string;
        googleEventId?: string | null;
        eventId?: string | null;
      };

    if (!googleEventId && !eventId && (!eventTitle || !startDate)) {
      return NextResponse.json(
        { error: 'Missing googleEventId, eventId, or eventTitle/startDate' },
        { status: 400 },
      );
    }

    // Recolectar todos los tokens relevantes (miembros + dueño + usuario activo)
    const tokenSources: GoogleTokens[] = [];
    const dedup = new Set<string>();

    const userStoredTokens = await getUserGoogleTokens(user.id);
    const userSessionTokens = getSessionGoogleTokens(
      (session as AuthSessionLike | null) || null,
    );
    const userTokens = userStoredTokens || userSessionTokens;
    if (userTokens) {
      const ownKey = userTokens.refresh_token || userTokens.access_token;
      if (ownKey) {
        dedup.add(ownKey);
        tokenSources.push(userTokens);
      }
    }

    if (projectId) {
      const hasAccess = await userHasProjectAccess(projectId, user.id);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const projectTokens = await getProjectGoogleTokens(projectId);
      projectTokens.forEach((row) => {
        const key = row.refresh_token || row.access_token;
        if (!key || dedup.has(key)) return;
        dedup.add(key);
        tokenSources.push(toGoogleTokens(row));
      });
    }

    if (tokenSources.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: 'No hay cuentas de Google conectadas para este proyecto',
      });
    }

    let totalDeleted = 0;
    for (const sourceTokens of tokenSources) {
      try {
        totalDeleted += await deleteGoogleEventForSource({
          tokens: sourceTokens,
          googleEventId,
          eventId,
          eventTitle,
          startDate,
        });
      } catch (err) {
        // Continuar con los siguientes tokens aunque uno falle
        console.error('Error eliminando en una cuenta de Google:', err);
      }
    }

    return NextResponse.json({
      success: true,
      deleted: totalDeleted,
    });
  } catch (error: unknown) {
    console.error('Error al eliminar evento:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Error al eliminar evento';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
