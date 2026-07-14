import { NextRequest, NextResponse } from 'next/server';
import { calendar_v3 } from 'googleapis';
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
import { EditCalendarEventRequest } from '@/types/calendarEventEditing';
import {
  applySeriesEditLocally,
  EditableEventRow,
  extractRecurrenceDays,
  isoDateOnly,
  addDaysToIsoDate,
  resolveEditTarget,
  splitDateAndTime,
} from '@/lib/calendarSeriesEdit';

type GoogleTokenRow = {
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

type AuthSessionLike = {
  provider_token?: string | null;
  provider_refresh_token?: string | null;
  user?: {
    app_metadata?: { provider?: string };
    identities?: Array<{ provider?: string }>;
  };
};

type SyncEventPayload = {
  id?: string;
  project_id?: string;
  google_event_id?: string | null;
  title: string;
  start_date: string;
  [key: string]: unknown;
};

type LocalEventLink = {
  id: string;
  project_id: string;
  google_event_id: string | null;
};

type SyncGoogleResult = {
  action: 'created' | 'updated' | 'linked' | 'skipped';
  data?: calendar_v3.Schema$Event;
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const getGoogleErrorStatus = (error: unknown) => {
  const err = error as {
    code?: number;
    response?: { status?: number; data?: { code?: number } };
  };
  return err?.response?.status || err?.response?.data?.code || err?.code || null;
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
  if (!session?.provider_token) return null;
  const provider = session.user?.app_metadata?.provider;
  const identities = session.user?.identities || [];
  const hasGoogleIdentity = identities.some((i) => i.provider === 'google');
  if (provider !== 'google' && !hasGoogleIdentity) return null;
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
  if (error) throw error;
  if (!data) return null;
  return toGoogleTokens(data);
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

const getLocalEventLink = async (
  event: SyncEventPayload,
  userId: string,
): Promise<LocalEventLink | null> => {
  if (!event.id) return null;
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
    formatEventForGoogle(linkedEvent, { asException: options?.asException }),
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

const resolveGoogleTimeZone = (
  googleEvent: calendar_v3.Schema$Event | null | undefined,
  fallback: string,
) =>
  googleEvent?.start?.timeZone ||
  googleEvent?.originalStartTime?.timeZone ||
  fallback ||
  'UTC';

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

const findRecurringInstanceForLocalEvent = async (
  calendarService: GoogleCalendarService,
  recurringEventId: string,
  originalStartDate: string,
) => {
  const dateOnly = isoDateOnly(originalStartDate);
  const instances = await calendarService.listEventInstances(recurringEventId, {
    timeMin: `${dateOnly}T00:00:00Z`,
    timeMax: `${addDaysToIsoDate(dateOnly, 1)}T00:00:00Z`,
    maxResults: 20,
  });
  return matchGoogleInstanceByOriginalDate(instances, originalStartDate);
};

const syncSingleOccurrenceToGoogle = async ({
  calendarService,
  event,
  originalStartDate,
  seriesMasterGoogleEventId,
  userId,
  timesChanged,
  timeZone,
}: {
  calendarService: GoogleCalendarService;
  event: EditableEventRow;
  originalStartDate: string;
  seriesMasterGoogleEventId: string | null;
  userId: string;
  timesChanged: boolean;
  timeZone: string;
}): Promise<SyncGoogleResult | null> => {
  const localEvent = await getLocalEventLink(toSyncPayloadFromEvent(event), userId);
  const payload = { ...toSyncPayloadFromEvent(event), time_zone: timeZone };
  const exceptionBody = buildLinkedGoogleEvent(payload, localEvent, {
    asException: true,
  });

  const ownGoogleId = localEvent?.google_event_id || event.google_event_id;
  const isOwnExceptionInstance =
    Boolean(ownGoogleId) && ownGoogleId !== seriesMasterGoogleEventId;

  const buildExceptionPatch = (
    googleSource?: calendar_v3.Schema$Event | null,
  ) => {
    const patch: calendar_v3.Schema$Event = {
      summary: exceptionBody.summary,
      description: exceptionBody.description,
      extendedProperties: exceptionBody.extendedProperties,
    };
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

  if (!seriesMasterGoogleEventId) return null;

  const instance = await findRecurringInstanceForLocalEvent(
    calendarService,
    seriesMasterGoogleEventId,
    originalStartDate,
  );
  if (!instance?.id) return null;

  const updated = await calendarService.patchEvent(
    instance.id,
    buildExceptionPatch(instance),
  );
  await persistGoogleEventId(localEvent, updated.id || instance.id);
  return { action: 'updated', data: updated };
};

const syncEventWithGoogle = async ({
  calendarService,
  event,
  userId,
}: {
  calendarService: GoogleCalendarService;
  event: SyncEventPayload;
  userId: string;
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

  const created = await calendarService.createEvent(googleEvent);
  await persistGoogleEventId(localEvent, created.id);
  return { action: 'created', data: created };
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

const buildGoogleStats = (
  result: SyncGoogleResult | null,
  attempted: boolean,
) => ({
  attempted,
  updated: result?.action === 'updated' ? 1 : 0,
  linked: result?.action === 'linked' ? 1 : 0,
  created: result?.action === 'created' ? 1 : 0,
  errors: 0,
});

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user, session } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as EditCalendarEventRequest;
    const {
      eventId,
      projectId,
      scope,
      changes,
      occurrenceStart: occurrenceStartInput,
      applyToGoogle = true,
    } = body;

    if (!eventId || !projectId || !scope || !changes) {
      return NextResponse.json(
        { error: 'Missing eventId, projectId, scope or changes' },
        { status: 400 },
      );
    }

    if (!['single', 'all', 'this_and_following'].includes(scope)) {
      return NextResponse.json({ error: 'Scope inválido' }, { status: 400 });
    }

    const canEdit = await userCanEditProjectEvents(projectId, user.id);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden: solo Owner/Admin puede editar eventos' },
        { status: 403 },
      );
    }

    let resolved;
    try {
      resolved = await resolveEditTarget({
        eventId,
        projectId,
        occurrenceStart: occurrenceStartInput,
      });
    } catch (error: unknown) {
      const status =
        error && typeof error === 'object' && 'status' in error
          ? Number((error as { status: number }).status)
          : 500;
      const message =
        error instanceof Error ? error.message : 'Error al resolver evento';
      return NextResponse.json({ error: message }, { status });
    }

    const editContext = await applySeriesEditLocally({
      scope,
      projectId,
      userId: user.id,
      master: resolved.master,
      occurrenceStart: resolved.occurrenceStart,
      existingException: resolved.existingException,
      changes,
    });

    const effectiveScope = editContext.scope;
    const affectedSeriesId =
      editContext.master.series_id || editContext.master.id;

    if (!applyToGoogle) {
      return NextResponse.json({
        success: true,
        scope: effectiveScope,
        updatedEventIds: editContext.updatedEvents.map((e) => e.id),
        affectedSeriesId,
        google: {
          attempted: false,
          updated: 0,
          linked: 0,
          created: 0,
          errors: 0,
        },
      });
    }

    await ensureProGoogleAccess(supabase, user.id);

    const storedTokens = await getUserGoogleTokens(user.id);
    const sessionTokens = getSessionGoogleTokens(
      (session as AuthSessionLike | null) || null,
    );
    const tokens = storedTokens || sessionTokens;

    if (!tokens) {
      return NextResponse.json({
        success: true,
        scope: effectiveScope,
        updatedEventIds: editContext.updatedEvents.map((e) => e.id),
        affectedSeriesId,
        google: {
          attempted: false,
          updated: 0,
          linked: 0,
          created: 0,
          errors: 1,
        },
        message:
          'Evento actualizado en Veenzo, pero Google Calendar no está conectado.',
      });
    }

    const calendarService = new GoogleCalendarService(tokens);
    const editTimeZone = changes.time_zone || 'UTC';

    // --- single: excepción de instancia ---
    if (effectiveScope === 'single' && resolved.master.is_recurring) {
      let googleTimeZone = editTimeZone;
      const masterGoogleId =
        editContext.oldMasterGoogleEventId || resolved.master.google_event_id;
      if (masterGoogleId) {
        try {
          const masterGoogleEvent =
            await calendarService.getEvent(masterGoogleId);
          googleTimeZone = resolveGoogleTimeZone(masterGoogleEvent, editTimeZone);
        } catch (error) {
          if (!isGoogleNotFoundError(error)) throw error;
        }
      }

      const singleResult = await syncSingleOccurrenceToGoogle({
        calendarService,
        event: editContext.targetForSingle,
        originalStartDate: editContext.occurrenceStart,
        seriesMasterGoogleEventId: masterGoogleId,
        userId: user.id,
        timesChanged: editContext.timesChanged,
        timeZone: googleTimeZone,
      });

      if (!singleResult) {
        return NextResponse.json({
          success: true,
          scope: effectiveScope,
          updatedEventIds: editContext.updatedEvents.map((e) => e.id),
          affectedSeriesId,
          google: buildGoogleStats(null, false),
          message:
            'Evento actualizado en Veenzo. No se encontró la instancia en Google Calendar.',
        });
      }

      return NextResponse.json({
        success: true,
        scope: effectiveScope,
        action: singleResult.action,
        updatedEventIds: editContext.updatedEvents.map((e) => e.id),
        affectedSeriesId,
        google_event_id: singleResult.data?.id || null,
        google: buildGoogleStats(singleResult, true),
      });
    }

    // --- this_and_following con serie nueva: truncar + crear ---
    if (effectiveScope === 'this_and_following' && editContext.createdNewSeries) {
      let googleTimeZone = editTimeZone;
      if (editContext.oldMasterGoogleEventId) {
        try {
          const masterGoogleEvent = await calendarService.getEvent(
            editContext.oldMasterGoogleEventId,
          );
          googleTimeZone = resolveGoogleTimeZone(masterGoogleEvent, editTimeZone);
          if (editContext.splitPivotDateOnly) {
            await truncateGoogleRecurringSeries(
              calendarService,
              editContext.oldMasterGoogleEventId,
              addDaysToIsoDate(editContext.splitPivotDateOnly, -1),
              googleTimeZone,
            );
          }
        } catch (error) {
          if (!isGoogleNotFoundError(error)) throw error;
        }
      }

      const newMasterPayload = toSyncPayloadFromEvent(editContext.master);
      newMasterPayload.google_event_id = null;
      newMasterPayload.time_zone = googleTimeZone;

      const splitResult = await syncEventWithGoogle({
        calendarService,
        event: newMasterPayload,
        userId: user.id,
      });

      return NextResponse.json({
        success: true,
        scope: effectiveScope,
        action: splitResult.action,
        updatedEventIds: editContext.updatedEvents.map((e) => e.id),
        affectedSeriesId,
        google_event_id: splitResult.data?.id || null,
        google: buildGoogleStats(splitResult, true),
      });
    }

    // --- all (o single one-off / this_and_following desde el primero) ---
    const master = editContext.master;
    let googleTimeZone = editTimeZone;
    let existingMaster: calendar_v3.Schema$Event | null = null;

    if (master.google_event_id) {
      try {
        existingMaster = await calendarService.getEvent(master.google_event_id);
        googleTimeZone = resolveGoogleTimeZone(existingMaster, editTimeZone);
      } catch (error) {
        if (!isGoogleNotFoundError(error)) throw error;
      }
    }

    const syncPayload = toSyncPayloadFromEvent(master);
    syncPayload.time_zone = googleTimeZone;

    if (master.google_event_id && !editContext.timesChanged) {
      const googleEvent = buildLinkedGoogleEvent(syncPayload, {
        id: master.id,
        project_id: master.project_id,
        google_event_id: master.google_event_id,
      });
      const patched = await calendarService.patchEvent(master.google_event_id, {
        summary: googleEvent.summary,
        description: googleEvent.description,
        recurrence: googleEvent.recurrence,
        extendedProperties: googleEvent.extendedProperties,
      });
      return NextResponse.json({
        success: true,
        scope: effectiveScope,
        action: 'updated',
        updatedEventIds: editContext.updatedEvents.map((e) => e.id),
        affectedSeriesId,
        google_event_id: patched.id || master.google_event_id,
        google: buildGoogleStats({ action: 'updated', data: patched }, true),
      });
    }

    const result = await syncEventWithGoogle({
      calendarService,
      event: syncPayload,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      scope: effectiveScope,
      action: result.action,
      updatedEventIds: editContext.updatedEvents.map((e) => e.id),
      affectedSeriesId,
      google_event_id: result.data?.id || master.google_event_id || null,
      google: buildGoogleStats(result, true),
    });
  } catch (error: unknown) {
    console.error('Error al editar evento:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Error al editar evento';
    const status = error instanceof HttpError ? error.status : 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
