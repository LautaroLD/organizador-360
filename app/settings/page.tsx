'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Header } from '@/components/ui/Header';
import { SettingsView } from '@/components/dashboard/SettingsView';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--bg-primary)]">
        <p className="text-[var(--text-secondary)]">Cargando sesión...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)]">
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
