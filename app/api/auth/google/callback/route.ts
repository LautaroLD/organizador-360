import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createHash } from 'crypto';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent('Error al conectar con Google')}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/dashboard?error=No authorization code', request.url)
    );
  }

  try {
    const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Intercambiar código por tokens
    let tokenResponse;
    try {
      tokenResponse = await oauth2Client.getToken(code as string);
    } catch (error) {
      console.error('Error en getToken:', error);
      throw error;
    }

    const tokens = tokenResponse?.tokens;
    
    if (!tokens) {
      throw new Error('No tokens received from Google');
    }

    oauth2Client.setCredentials(tokens);
    
    let userEmail = '';
    
    // Intentar obtener email del ID token (si existe)
    if (tokens.id_token) {
      try {
        const parts = tokens.id_token.split('.');
        if (parts.length === 3) {
          const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          userEmail = decoded.email || '';
        }
      } catch {
        // Silent fail for ID token extraction
      }
    }
    
    // Si no conseguimos el email del ID token, usar un identificador único del token
    if (!userEmail) {
      try {
        // Usar una combinación del access token como identificador único del usuario
        if (tokens.access_token) {
          const tokenHash = createHash('sha256')
            .update(tokens.access_token)
            .digest('hex')
            .substring(0, 16);
          userEmail = `google_user_${tokenHash}`;
        } else {
          throw new Error('No access_token available');
        }
      } catch (hashError) {
        console.warn('No se pudo crear identificador:', hashError);
        userEmail = '';
      }
    }
    
    // Extraer projectId del state parameter
    const projectId = state || '';

    // Crear objeto con tokens y email del usuario
    const authData = {
      tokens,
      userEmail
    };

    // Codificar datos para URL
    const authDataBase64 = Buffer.from(JSON.stringify(authData)).toString('base64');
    console.log('AuthData codificada. Length:', authDataBase64.length);
    
    // Redirigir a una página de callback en el cliente
    const redirectUrl = projectId 
      ? `/projects/${projectId}/calendar?google_auth=${authDataBase64}`
      : `/dashboard?google_auth=${authDataBase64}`;
    
    console.log('Redirigiendo a:', redirectUrl.substring(0, 50) + '...');
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    console.error('Error en callback de Google:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error message:', errorMsg);
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(errorMsg)}`, request.url)
    );
  }
}
