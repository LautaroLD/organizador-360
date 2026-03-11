// API Routes para sincronización con Google Calendar
import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/googleCalendar';
import { formatEventForGoogle } from '@/lib/googleCalendarUtils';
import { supabaseAdmin } from '@/lib/supabase/admin';

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

interface SyncEventPayload {
  title: string;
  start_date: string;
  [key: string]: unknown;
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

const toGoogleTokens = (row: GoogleTokenRow): GoogleTokens => ({
  access_token: row.access_token,
  refresh_token: row.refresh_token,
  scope: row.scope || 'https://www.googleapis.com/auth/calendar',
  token_type: row.token_type || 'Bearer',
  expiry_date: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
});

const deleteMatchingEvents = async (
  tokens: GoogleTokens,
  eventTitle: string,
  startDate: string,
) => {
  const calendarService = new GoogleCalendarService(tokens);
  const events = await calendarService.getEvents();
  const matchingEvents = events.filter((event: calendar_v3.Schema$Event) =>
    normalizeTitle(event.summary || '') === normalizeTitle(eventTitle) &&
    getEventStartDate(event) === startDate
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
    const body = await request.json();
    const { tokens, event, events, checkDuplicate = false } = body as {
      tokens?: GoogleTokens;
      event?: SyncEventPayload;
      events?: SyncEventPayload[];
      checkDuplicate?: boolean;
    };

    if (!tokens) {
      return NextResponse.json(
        { error: 'No tokens provided' },
        { status: 401 }
      );
    }

    const calendarService = new GoogleCalendarService(tokens);

    // Sincronizacion en lote
    if (Array.isArray(events)) {
      if (events.length === 0) {
        return NextResponse.json({
          success: true,
          created: 0,
          skipped: 0,
          errors: 0,
        });
      }

      const existingSignatures = new Set<string>();
      if (checkDuplicate) {
        const existingEvents = await calendarService.getEvents();
        existingEvents.forEach((googleEvent: calendar_v3.Schema$Event) => {
          const title = googleEvent.summary;
          const startDate = getEventStartDate(googleEvent);
          if (!title || !startDate) return;
          existingSignatures.add(buildEventSignature(title, startDate));
        });
      }

      let created = 0;
      let skipped = 0;
      let errors = 0;

      for (const currentEvent of events) {
        try {
          const signature = buildEventSignature(currentEvent.title, currentEvent.start_date);

          if (checkDuplicate && existingSignatures.has(signature)) {
            skipped += 1;
            continue;
          }

          const googleEvent = formatEventForGoogle(currentEvent);
          await calendarService.createEvent(googleEvent);
          created += 1;

          if (checkDuplicate) {
            existingSignatures.add(signature);
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
        skipped,
        errors,
      });
    }

    if (!event) {
      return NextResponse.json(
        { error: 'No event payload provided' },
        { status: 400 }
      );
    }

    // Sincronizacion individual
    if (checkDuplicate) {
      const existingEvents = await calendarService.getEvents();
      const eventSignature = buildEventSignature(event.title, event.start_date);

      const isDuplicate = existingEvents.some((googleEvent: calendar_v3.Schema$Event) => {
        const title = googleEvent.summary;
        const startDate = getEventStartDate(googleEvent);
        if (!title || !startDate) return false;
        return buildEventSignature(title, startDate) === eventSignature;
      });

      if (isDuplicate) {
        return NextResponse.json({
          success: true,
          skipped: true,
          message: 'Event already exists'
        });
      }
    }

    const googleEvent = formatEventForGoogle(event);
    const result = await calendarService.createEvent(googleEvent);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error('Error al sincronizar evento:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al sincronizar evento';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Obtener eventos de Google Calendar
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokensParam = searchParams.get('tokens');

    if (!tokensParam) {
      return NextResponse.json(
        { error: 'No tokens provided' },
        { status: 401 }
      );
    }

    const tokens = JSON.parse(decodeURIComponent(tokensParam));
    const calendarService = new GoogleCalendarService(tokens);
    const events = await calendarService.getEvents();

    return NextResponse.json({ success: true, data: events });
  } catch (error: unknown) {
    console.error('Error al obtener eventos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al obtener eventos';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Eliminar evento de Google Calendar
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokens, eventTitle, startDate, projectId } = body;

    if (!eventTitle || !startDate) {
      return NextResponse.json(
        { error: 'Missing eventTitle or startDate' },
        { status: 400 }
      );
    }

    // Recolectar todos los tokens relevantes (miembros + dueño + usuario activo)
    const tokenSources: GoogleTokens[] = [];
    const dedup = new Set<string>();

    if (projectId) {
      const projectTokens = await getProjectGoogleTokens(projectId);
      projectTokens.forEach((row) => {
        const key = row.refresh_token || row.access_token;
        if (!key || dedup.has(key)) return;
        dedup.add(key);
        tokenSources.push(toGoogleTokens(row));
      });
    }

    if (tokens) {
      const key = tokens.refresh_token || tokens.access_token;
      if (key && !dedup.has(key)) {
        dedup.add(key);
        tokenSources.push(tokens);
      }
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
        totalDeleted += await deleteMatchingEvents(sourceTokens, eventTitle, startDate);
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
    const errorMessage = error instanceof Error ? error.message : 'Error al eliminar evento';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
