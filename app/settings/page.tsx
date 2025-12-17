'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Header } from '@/components/ui/Header';
import { SettingsView } from '@/components/dashboard/SettingsView';

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push('/auth');
          return;
        }

        setUser(session.user);
      } catch (error) {
        console.error('Error checking auth:', error);
        router.push('/auth');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, setUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <p className="text-[var(--text-secondary)]">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Header
        title="Configuración"
        subtitle="Personaliza tu experiencia y preferencias"
      />

      <main className="min-h-[calc(100vh-73px)]">
        <SettingsView />
      </main>
    </div>
  );
}
