import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';

const ISSUER = 'https://accounts.google.com';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export async function POST(req: NextRequest) {
  try {
    // 1. Obtener el token (SET - Security Event Token)
    const token = await req.text();

    if (!token) {
      return new NextResponse('Missing Security Event Token', { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    // 2. Configurar la verificación de la firma
    const JWKS = jose.createRemoteJWKSet(new URL(GOOGLE_CERTS_URL));

    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: clientId, // Google enviará tu Client ID aquí
    });

    // 3. Lógica de procesamiento de eventos
    const events = payload.events as Record<string, unknown>;

    // --- CAMBIO CLAVE: Manejar evento de verificación de Google ---
    if (
      events['https://schemas.openid.net/secevent/risc/event-type/verification']
    ) {
      return new NextResponse('Accepted', { status: 202 });
    }

    // --- Manejar otros eventos (Ejemplo: Sesiones revocadas) ---
    if (
      events[
        'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked'
      ]
    ) {
      // Aquí iría tu lógica de Supabase o DB:
      // await supabase.auth.admin.signOut(subject);
    }

    return new NextResponse('Accepted', { status: 202 });
  } catch (error) {
    console.error('RISC Verification failed:', error);
    // Es importante devolver 400 si la firma falla para que Google sepa que hay un error
    return new NextResponse('Invalid Token', { status: 400 });
  }
}
