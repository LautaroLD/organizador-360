'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { createClient } from '@/lib/supabase/client';
import { Code2, MessageSquare, FolderKanban, Calendar, Sparkles } from 'lucide-react';

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

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--text-secondary)]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Code2 className="h-8 w-8 text-[var(--accent-primary)]" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">DevCore</h1>
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
        <h2 className="text-5xl font-bold text-[var(--text-primary)] mb-6">
          Colaboración Todo-en-Uno
          <br />
          <span className="text-[var(--accent-primary)]">para Equipos de Desarrollo</span>
        </h2>
        <p className="text-xl text-[var(--text-secondary)] mb-8 max-w-2xl mx-auto">
          Deja de cambiar entre múltiples herramientas. DevCore centraliza el chat,
          proyectos, documentación y calendario en un solo lugar.
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

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto p-12 rounded-lg bg-[var(--accent-primary)] text-white">
          <h3 className="text-3xl font-bold mb-4">
            ¿Listo para mejorar la productividad de tu equipo?
          </h3>
          <p className="text-lg mb-6 opacity-90">
            Únete a cientos de equipos que ya están usando DevCore
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
        <div className="container mx-auto px-4 text-center text-[var(--text-secondary)]">
          <p>&copy; 2024 DevCore. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
