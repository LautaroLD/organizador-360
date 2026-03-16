import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;
  const next = requestUrl.searchParams.get('next');
  const pendingInvitation = requestUrl.searchParams.get('invitation');

  if (code) {
    const supabase = await createClient();

    const targetRedirect = pendingInvitation
      ? `${origin}/invitations/${pendingInvitation}`
      : next
        ? `${origin}${next}`
        : `${origin}/dashboard`;

    // Flow OAuth/Email code exchange
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(error.message)}`);
    }

    // Si el usuario se autenticó con Google y tiene tokens de provider
    if (data.session?.provider_token) {
      // Los tokens de Google Calendar ya están en la sesión
      // Se pueden usar directamente sin necesidad de guardarlos aparte
    }

    return NextResponse.redirect(targetRedirect);
  }

  // Redirigir al dashboard por defecto
  return NextResponse.redirect(`${origin}/dashboard`);
}
