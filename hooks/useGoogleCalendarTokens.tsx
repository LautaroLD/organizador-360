'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useGoogleCalendarStore } from '@/store/googleCalendarStore';

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number | null;
}

interface UseGoogleCalendarTokensReturn {
  tokens: GoogleTokens | null;
  isConnected: boolean;
  isLoading: boolean;
  userEmail: string | null;
  authMethod: 'google_login' | 'manual_link' | null;
  isGoogleUser: boolean; // Indica si el usuario se registró con Google
  needsReconnect: boolean; // Indica si el usuario de Google necesita reconectar para Calendar
  connectGoogleCalendar: (projectId?: string) => Promise<void>;
  disconnectGoogleCalendar: () => Promise<void>;
  refreshTokensFromSession: () => Promise<void>;
  processOAuthCallback: (params: {
    googleAuthParam: string | null;
    errorParam: string | null;
    projectId?: string;
  }) => Promise<{
    handled: boolean;
    status: 'success' | 'error' | 'none';
    message?: string;
    infoMessage?: string;
    redirectTo?: string;
  }>;
}

/**
 * Hook unificado para manejar tokens de Google Calendar.
 * 
 * Soporta dos métodos de conexión:
 * 1. Login con Google (automático): Los tokens vienen de la sesión de Supabase
 * 2. Vinculación manual: Para usuarios que se registraron con email/contraseña
 */
export function useGoogleCalendarTokens(): UseGoogleCalendarTokensReturn {
  const supabase = createClient();
  const { user } = useAuthStore();
  const { tokens, isConnected, userEmail, setTokens, disconnect } = useGoogleCalendarStore();
  const [isLoading, setIsLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<'google_login' | 'manual_link' | null>(null);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const getRedirectPath = useCallback((projectId?: string) => {
    return projectId ? `/projects/${projectId}/calendar` : '/dashboard';
  }, []);

  // Cargar tokens al montar (prioriza sesión de Google, luego tabla manual)
  useEffect(() => {
    const loadTokens = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // 1. Primero verificar si el usuario se autenticó con Google
        const { data: { session } } = await supabase.auth.getSession();

        // Detectar si es usuario de Google (puede estar en app_metadata o identities)
        const provider = session?.user?.app_metadata?.provider;
        const identities = session?.user?.identities || [];
        const hasGoogleIdentity = identities.some((id: { provider?: string; }) => id.provider === 'google');
        const userIsFromGoogle = provider === 'google' || hasGoogleIdentity;

        setIsGoogleUser(userIsFromGoogle);

        if (session?.provider_token && userIsFromGoogle) {
          // Usuario autenticado con Google Y tiene provider_token - usar tokens de sesión
          const sessionTokens: GoogleTokens = {
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token || undefined,
            scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
            token_type: 'Bearer',
            expiry_date: null, // Supabase maneja la renovación
          };

          setTokens(sessionTokens, session.user.email || undefined);
          setAuthMethod('google_login');
          setNeedsReconnect(false);
          setIsLoading(false);
          return;
        }

        // 2. Si no hay tokens de sesión, buscar en tabla de vinculación manual
        const { data, error } = await supabase
          .from('google_calendar_tokens')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error || !data) {
          // Si es usuario de Google pero no tiene tokens, necesita reconectar
          if (userIsFromGoogle) {
            setNeedsReconnect(true);
          }
          setIsLoading(false);
          return;
        }

        // Verificar expiración
        const now = new Date();
        const expiresAt = data.expires_at ? new Date(data.expires_at) : null;

        if (expiresAt && now > expiresAt) {
          // Token expirado - eliminar
          await supabase.from('google_calendar_tokens').delete().eq('user_id', user.id);
          disconnect();
          setIsLoading(false);
          return;
        }

        // Tokens válidos de vinculación manual
        const manualTokens: GoogleTokens = {
          access_token: data.access_token,
          refresh_token: data.refresh_token || undefined,
          scope: data.scope || 'https://www.googleapis.com/auth/calendar',
          token_type: data.token_type || 'Bearer',
          expiry_date: expiresAt ? expiresAt.getTime() : null,
        };

        setTokens(manualTokens, data.user_email);
        setAuthMethod('manual_link');
      } catch (error) {
        console.error('Error cargando tokens de Google:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTokens();
  }, [user?.id, supabase, setTokens, disconnect]);

  // Refrescar tokens desde la sesión (útil después de reconexión)
  const refreshTokensFromSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.provider_token && session?.user?.app_metadata?.provider === 'google') {
      const sessionTokens: GoogleTokens = {
        access_token: session.provider_token,
        refresh_token: session.provider_refresh_token || undefined,
        scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
        token_type: 'Bearer',
        expiry_date: null,
      };

      setTokens(sessionTokens, session.user.email || undefined);
      setAuthMethod('google_login');
    }
  }, [supabase, setTokens]);

  // Conectar Google Calendar (para usuarios sin login con Google)
  const connectGoogleCalendar = useCallback(async (projectId?: string) => {
    try {
      const response = await fetch(`/api/google/auth-url?projectId=${projectId || ''}`);
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error al obtener URL de autorización:', error);
      throw new Error('Error al conectar con Google Calendar');
    }
  }, []);

  // Desconectar Google Calendar
  const disconnectGoogleCalendar = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Si era vinculación manual, eliminar de la tabla
      if (authMethod === 'manual_link') {
        await supabase.from('google_calendar_tokens').delete().eq('user_id', user.id);
      }

      // Limpiar store local
      disconnect();
      setAuthMethod(null);
    } catch (error) {
      console.error('Error al desconectar Google Calendar:', error);
      throw error;
    }
  }, [user?.id, authMethod, supabase, disconnect]);

  const processOAuthCallback = useCallback(async ({
    googleAuthParam,
    errorParam,
    projectId,
  }: {
    googleAuthParam: string | null;
    errorParam: string | null;
    projectId?: string;
  }) => {
    const redirectTo = getRedirectPath(projectId);

    if (!googleAuthParam && !errorParam) {
      return { handled: false, status: 'none' as const };
    }

    if (errorParam) {
      return {
        handled: true,
        status: 'error' as const,
        message: decodeURIComponent(errorParam),
        redirectTo,
      };
    }

    try {
      const authJson = atob(googleAuthParam as string);
      const authData = JSON.parse(authJson);
      const { tokens: oauthTokens, userEmail: newUserEmail } = authData;

      let infoMessage: string | undefined;
      if (userEmail && newUserEmail && userEmail !== newUserEmail) {
        disconnect();
        infoMessage = `Cambiando a cuenta de Google: ${newUserEmail}`;
      }

      const existingUserId = user?.id || newUserEmail;
      const expiresAt = oauthTokens.expiry_date
        ? new Date(oauthTokens.expiry_date).toISOString()
        : null;

      const { data: existing } = await supabase
        .from('google_calendar_tokens')
        .select('id')
        .eq('user_id', existingUserId)
        .maybeSingle();

      const tokenData = {
        access_token: oauthTokens.access_token,
        refresh_token: oauthTokens.refresh_token || null,
        scope: oauthTokens.scope || 'https://www.googleapis.com/auth/calendar',
        token_type: oauthTokens.token_type || 'Bearer',
        expires_at: expiresAt,
        user_email: newUserEmail,
        ...(existing && { updated_at: new Date().toISOString() }),
      };

      const { error: saveError } = existing
        ? await supabase
          .from('google_calendar_tokens')
          .update(tokenData)
          .eq('user_id', existingUserId)
        : await supabase
          .from('google_calendar_tokens')
          .insert({ ...tokenData, user_id: existingUserId });

      if (saveError) {
        throw saveError;
      }

      setTokens(oauthTokens, newUserEmail);

      return {
        handled: true,
        status: 'success' as const,
        message: 'Google Calendar conectado exitosamente',
        infoMessage,
        redirectTo,
      };
    } catch (error) {
      console.error('Error al procesar callback OAuth de Google Calendar:', error);
      return {
        handled: true,
        status: 'error' as const,
        message: 'Error al conectar con Google Calendar',
        redirectTo,
      };
    }
  }, [disconnect, getRedirectPath, setTokens, supabase, user?.id, userEmail]);

  return {
    tokens,
    isConnected,
    isLoading,
    userEmail,
    authMethod,
    isGoogleUser,
    needsReconnect,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    refreshTokensFromSession,
    processOAuthCallback,
  };
}
