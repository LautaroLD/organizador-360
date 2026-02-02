'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { createClient } from '@/lib/supabase/client';
import { Code2, MessageSquare, FolderKanban, Calendar, Sparkles, Bell, BarChart3, ShieldCheck, Users } from 'lucide-react';
import Logo from '@/components/ui/Logo';

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
    };
    checkUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const features = [
    {
      icon: <MessageSquare className="h-8 w-8" />,
      title: 'Chat en Tiempo Real',
      description: 'Comunícate con tu equipo de forma instantánea con canales organizados.',
    },
    {
      icon: <FolderKanban className="h-8 w-8" />,
      title: 'Gestión de Proyectos',
      description: 'Organiza tus proyectos y asigna roles a los miembros de tu equipo.',
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      title: 'Calendario Compartido',
      description: 'Sincroniza eventos con Google Calendar y mantén a todos informados.',
    },
    {
      icon: <Code2 className="h-8 w-8" />,
      title: 'Base de Conocimiento',
      description: 'Centraliza documentos, archivos y links importantes del proyecto.',
    },
    {
      icon: <Sparkles className="h-8 w-8" />,
      title: 'Asistente IA',
      description: 'Obtén resúmenes automáticos y respuestas inteligentes sobre tu proyecto.',
    },
  ];

  const capabilities = [
    {
      icon: <FolderKanban className="h-6 w-6" />,
      title: 'Kanban y tareas',
      description: 'Flujos de trabajo claros con estados y responsables.',
      badge: 'Disponible',
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Roles y permisos',
      description: 'Owner, Admin y Member con control por proyecto.',
      badge: 'Disponible',
    },
    {
      icon: <Code2 className="h-6 w-6" />,
      title: 'Base de conocimiento',
      description: 'Documentos, enlaces y recursos centralizados.',
      badge: 'Disponible',
    },
    {
      icon: <Calendar className="h-6 w-6" />,
      title: 'Google Calendar',
      description: 'Sincronización de eventos en tiempo real.',
      badge: 'Disponible',
    },
    {
      icon: <Bell className="h-6 w-6" />,
      title: 'Notificaciones',
      description: 'Alertas de actividad y cambios clave.',
      badge: 'Disponible',
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: 'Analítica con IA',
      description: 'Métricas avanzadas y recomendaciones inteligentes.',
      badge: 'Enterprise',
    },
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: 'IA de productividad',
      description: 'Generación de tareas y resúmenes automáticos.',
      badge: 'Pro/Enterprise',
    },
    {
      icon: <ShieldCheck className="h-6 w-6" />,
      title: 'Seguridad',
      description: 'Buenas prácticas y protección de datos.',
      badge: 'Disponible',
    },
  ];

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <header className="border-b border-[var(--text-secondary)]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Logo />
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <Button onClick={() => router.push('/auth')}>
              Comenzar
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-[var(--text-primary)] mb-6">
          Colaboración Todo-en-Uno
          <br />
          <span className="text-[var(--accent-primary)]">para Equipos de Desarrollo</span>
        </h1>
        <p className="text-xl text-[var(--text-secondary)] mb-8 max-w-2xl mx-auto">
          Deja de cambiar entre múltiples herramientas. Veenzo centraliza el chat,
          proyectos, documentación y calendario en un solo lugar.
        </p>
        <p className="text-base text-[var(--text-secondary)] mb-10 max-w-3xl mx-auto">
          Veenzo es una aplicación de gestión de equipos y proyectos con Kanban,
          tareas, calendario compartido y comunicación en tiempo real.
        </p>
        <div className="flex items-center justify-center space-x-4">
          <Button size="lg" onClick={() => router.push('/auth')}>
            Crear Cuenta Gratis
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h3 className="text-3xl font-bold text-center text-[var(--text-primary)] mb-12">
          Todo lo que necesitas en un solo lugar
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:shadow-lg transition-shadow"
            >
              <div className="text-[var(--accent-primary)] mb-4">
                {feature.icon}
              </div>
              <h4 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                {feature.title}
              </h4>
              <p className="text-[var(--text-secondary)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Prestaciones actuales */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h3 className="text-3xl font-bold text-[var(--text-primary)] mb-3">
            Prestaciones actuales de Veenzo
          </h3>
          <p className="text-[var(--text-secondary)]">
            Conoce lo que ya está disponible hoy, y qué incluye cada plan.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((item, index) => (
            <div
              key={index}
              className="p-5 rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-secondary)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[var(--accent-primary)]">
                  {item.icon}
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                  {item.badge}
                </span>
              </div>
              <h4 className="text-lg font-semibold text-[var(--text-primary)] mt-3">
                {item.title}
              </h4>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto p-12 rounded-lg bg-[var(--accent-primary)] text-white">
          <h3 className="text-3xl font-bold mb-4">
            ¿Listo para mejorar la productividad de tu equipo?
          </h3>
          <p className="text-lg mb-6 opacity-90">
            Únete a cientos de equipos que ya están usando Veenzo
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => router.push('/auth')}
          >
            Comenzar Ahora
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--text-secondary)] py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between text-[var(--text-secondary)] space-y-4 md:space-y-0">
            <p>&copy; 2026 Veenzo. Todos los derechos reservados.</p>
            <div className="flex items-center space-x-6">
              <a
                href="/privacy"
                className="hover:text-[var(--accent-primary)] transition-colors"
              >
                Política de Privacidad
              </a>
              <a
                href="/terms"
                className="hover:text-[var(--accent-primary)] transition-colors"
              >
                Términos de Servicio
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
