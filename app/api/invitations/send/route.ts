import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type SendInvitationPayload = {
  projectId?: string;
  inviteeEmail?: string | null;
  role?: string;
  inviteType?: 'email' | 'link';
  userToken?: string;
};

type EdgeResponsePayload = {
  success?: boolean;
  error?: string;
  message?: string;
  code?: number | string;
};

function isAuthError(status: number, data: EdgeResponsePayload | null) {
  const message = `${data?.error ?? ''} ${data?.message ?? ''}`.toLowerCase();
  return status === 401 || message.includes('invalid jwt') || message.includes('unauthorized');
}

function decodeJwtIss(token: string) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { iss?: string };
    return decoded.iss ?? null;
  } catch {
    return null;
  }
}

async function callInvitationFunction(params: {
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  payload: SendInvitationPayload;
  useUserTokenHeader?: boolean;
}) {
  const { supabaseUrl, anonKey, accessToken, payload, useUserTokenHeader = false } = params;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anonKey,
  };

  if (useUserTokenHeader) {
    headers.Authorization = `Bearer ${anonKey}`;
    headers['x-user-token'] = `Bearer ${accessToken}`;
  } else {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-invitation`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as EdgeResponsePayload | null;
  return { response, data };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const reqBody = (await request.json().catch(() => null)) as SendInvitationPayload | null;
    if (!reqBody?.projectId || !reqBody?.role) {
      return NextResponse.json(
        { success: false, error: 'projectId y role son requeridos' },
        { status: 400 }
      );
    }

    if ((reqBody.inviteType ?? 'email') === 'email' && !reqBody.inviteeEmail) {
      return NextResponse.json(
        { success: false, error: 'inviteeEmail es requerido para invitacion por email' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { success: false, error: 'Configuracion incompleta de Supabase' },
        { status: 500 }
      );
    }

    // Prefer refreshed token in SSR to avoid stale token state.
    const refreshed = await supabase.auth.refreshSession();
    let accessToken = refreshed.data.session?.access_token ?? null;

    if (!accessToken) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      accessToken = session?.access_token ?? null;
    }

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Sesion invalida. Inicia sesion nuevamente.' },
        { status: 401 }
      );
    }

    const withToken = (token: string): SendInvitationPayload => ({
      ...reqBody,
      userToken: token,
    });

    // Attempt 1: standard Authorization bearer user token
    let { response, data } = await callInvitationFunction({
      supabaseUrl,
      anonKey,
      accessToken,
      payload: withToken(accessToken),
    });

    // Attempt 2: x-user-token mode (some environments require anon in Authorization)
    if (isAuthError(response.status, data)) {
      ({ response, data } = await callInvitationFunction({
        supabaseUrl,
        anonKey,
        accessToken,
        payload: withToken(accessToken),
        useUserTokenHeader: true,
      }));
    }

    // Attempt 3/4: refresh one more time and retry both modes
    if (isAuthError(response.status, data)) {
      const refreshedAgain = await supabase.auth.refreshSession();
      const refreshedToken = refreshedAgain.data.session?.access_token;

      if (refreshedToken) {
        ({ response, data } = await callInvitationFunction({
          supabaseUrl,
          anonKey,
          accessToken: refreshedToken,
          payload: withToken(refreshedToken),
        }));

        if (isAuthError(response.status, data)) {
          ({ response, data } = await callInvitationFunction({
            supabaseUrl,
            anonKey,
            accessToken: refreshedToken,
            payload: withToken(refreshedToken),
            useUserTokenHeader: true,
          }));
        }
      }
    }

    if (isAuthError(response.status, data)) {
      const tokenIss = decodeJwtIss(accessToken);
      const expectedIss = `${supabaseUrl}/auth/v1`;

      return NextResponse.json(
        {
          success: false,
          error: data?.error || data?.message || 'Unauthorized',
          debug: {
            token_iss: tokenIss,
            expected_iss: expectedIss,
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.json(data ?? { success: false, error: 'Respuesta invalida' }, { status: response.status });
  } catch (error) {
    console.error('Error sending invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Error al enviar invitacion' },
      { status: 500 }
    );
  }
}
