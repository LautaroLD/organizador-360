import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canUseGoogleCalendar = await canUseAIFeatures(supabase, user.id);
    if (!canUseGoogleCalendar) {
      return NextResponse.json(
        {
          error:
            'La sincronización con Google Calendar está disponible solo para plan Pro',
        },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId') || '';

    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_REDIRECT_URI,
    );

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: projectId, // Incluir projectId en el state
    });

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error al generar URL de autorizaci\u00f3n:', error);
    return NextResponse.json(
      { error: 'Error al generar URL de autorizaci\u00f3n' },
      { status: 500 },
    );
  }
}
