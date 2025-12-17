'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeUserMessages } from '@/hooks/useRealtimeUserMessages';

export function AuthProvider({ children }: { children: React.ReactNode; }) {
  const supabase = createClient();
  const { user, setUser, setIsLoading } = useAuthStore();

  useRealtimeUserMessages({
    userId: user?.id,
    enabled: !!user?.id,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

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
