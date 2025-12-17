'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeUserMessages } from '@/hooks/useRealtimeUserMessages';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser, setIsLoading } = useAuthStore();

  // Subscribe to realtime messages for all user's projects
  // This persists across all views and projects
  useRealtimeUserMessages({
    userId: user?.id,
    enabled: !!user?.id,
  });

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Escuchar cambios en la autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setUser, setIsLoading]);

  return <>{children}</>;
}
