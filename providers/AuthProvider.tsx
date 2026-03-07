'use client';

import { useEffect, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useRealtimeUserMessages } from '@/hooks/useRealtimeUserMessages';

export function AuthProvider({ children }: { children: React.ReactNode; }) {
  const supabase = useMemo(() => createClient(), []);
  const { user, setUser, setIsLoading } = useAuthStore();
  const { setCustomColors } = useThemeStore();

  useRealtimeUserMessages({
    userId: user?.id,
    enabled: !!user?.id,
  });

  useEffect(() => {
    const syncThemeColors = async (userId: string | undefined) => {
      if (!userId) {
        setCustomColors({ light: null, dark: null });
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('custom_color_light, custom_color_dark')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading custom theme colors:', error);
        return;
      }

      setCustomColors({
        light: data?.custom_color_light ?? null,
        dark: data?.custom_color_dark ?? null,
      });
    };

    const applySessionState = async (session: Session | null) => {
      try {
        setUser(session?.user ?? null);
        await syncThemeColors(session?.user?.id);
      } catch (error) {
        console.error('Error applying auth session state:', error);
      } finally {
        // Never block the app in loading state if theme sync fails.
        setIsLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void applySessionState(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySessionState(session);
    });

    return () => subscription.unsubscribe();

  }, [setUser, setIsLoading, setCustomColors, supabase]);

  return <>{children}</>;
}
