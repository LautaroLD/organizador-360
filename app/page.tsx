'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuthStore } from '@/store/authStore';
import {
  Code2, MessageSquare, FolderKanban, Calendar, Sparkles,
  BarChart3, Check, Zap, ArrowRight,
  GitBranch, FileText, Link2, Star, Bell, HardDrive,
} from 'lucide-react';
import Logo from '@/components/ui/Logo';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [authLoading, user, router]);

  const stats = [
    { value: 'Todo en uno', label: 'Sin cambiar de pestaña' },
    { value: 'IA incluida', label: 'En planes Pro' },
    { value: 'Gratis', label: 'Para empezar' },
    { value: 'Tiempo real', label: 'Chat y eventos' },
  ];

  const features = [
    {
      icon: <MessageSquare className="h-7 w-7" />,
      title: 'Chat en Tiempo Real',
      description: 'Canales organizados por proyecto. Mensajes instantáneos sin salir del flujo de trabajo.',
    },
    {
      icon: <FolderKanban className="h-7 w-7" />,
      title: 'Kanban Avanzado',
      description: 'Tableros visuales con fases de roadmap, prioridades, fechas estimadas y asignaciones.',
    },
    {
      icon: <Calendar className="h-7 w-7" />,
      title: 'Calendario Compartido',
      description: 'Sincronización bidireccional con Google Calendar. Todos ven los mismos eventos.',
    },
    {
      icon: <Code2 className="h-7 w-7" />,
      title: 'Base de Conocimiento',
      description: 'Documentos, archivos y links centralizados. Analiza recursos con IA al instante.',
    },
    {
      icon: <Sparkles className="h-7 w-7" />,
      title: 'Asistente IA Integrado',
      description: 'Genera tareas, resúmenes de chat y analíticas avanzadas del proyecto con Gemini.',
    },
    {
      icon: <BarChart3 className="h-7 w-7" />,
      title: 'Analítica de Proyectos',
      description: 'Métricas de velocidad, precisión en estimaciones y rendimiento por miembro.',
    },
  ];

  const benefits = [
    { icon: <MessageSquare className="h-5 w-5" />, title: 'Chat en tiempo real', description: 'Canales por proyecto para que la conversación viva junto al trabajo.' },
    { icon: <FolderKanban className="h-5 w-5" />, title: 'Kanban + Roadmap', description: 'Tableros visuales con fases, prioridades y asignación de tareas.' },
    { icon: <Calendar className="h-5 w-5" />, title: 'Calendario compartido', description: 'Eventos del equipo en un solo lugar, visibles para todos.' },
    { icon: <Link2 className="h-5 w-5" />, title: 'Sync con Google Calendar', description: 'Sincronización bidireccional para mantener fechas alineadas.' },
    { icon: <Sparkles className="h-5 w-5" />, title: 'Asistente IA nativo', description: 'Genera tareas, resúmenes y respuestas con contexto del proyecto.' },
    { icon: <BarChart3 className="h-5 w-5" />, title: 'Analítica con IA', description: 'Métricas de progreso, workload y salud del equipo.' },
    { icon: <HardDrive className="h-5 w-5" />, title: 'Gestión de archivos', description: 'Documentos y recursos centralizados en cada proyecto.' },
    { icon: <Bell className="h-5 w-5" />, title: 'Notificaciones push', description: 'Alertas en tiempo real para no perderte lo importante.' },
    { icon: <Zap className="h-5 w-5" />, title: 'Plan gratuito real', description: 'Empieza sin tarjeta y escala cuando tu equipo lo necesite.' },
  ];

  const plans = [
    {
      name: 'Free',
      description: 'Para empezar sin costo',
      icon: <Zap className="h-5 w-5" />,
      features: ['3 proyectos', 'Chat ilimitado', '100 MB de recursos', 'Hasta 10 miembros/proyecto'],
      cta: 'Comenzar gratis',
      highlighted: false,
    },
    {
      name: 'Starter',
      description: 'Para equipos en crecimiento',
      icon: <Star className="h-5 w-5" />,
      features: ['5 proyectos', 'Chat ilimitado', '1 GB de recursos', 'Hasta 15 miembros/proyecto'],
      cta: 'Ver planes',
      highlighted: false,
    },
    {
      name: 'Pro',
      description: 'Todo el poder de Veenzo',
      icon: <><Star className="h-5 w-5" /> <Star className="h-5 w-5" /></>,
      features: [
        '10 proyectos',
        'Asistente IA con Gemini',
        '5 GB de recursos',
        'Hasta 30 miembros/proyecto',
        'Salud del equipo y workload',
        'Workspace y directorio multi-proyecto',
        'Sync Google Calendar',
        'Exportar datos',
        'Plantillas y onboarding',
        'Aprobaciones y permisos granulares',
        'Analítica avanzada con IA',
        'Resúmenes y generación de tareas',
      ],
      cta: 'Ver planes',
      highlighted: true,
    },
  ];

  const whyVeenzo = [
    {
      icon: <GitBranch className="h-6 w-6" />,
      title: 'Un solo espacio de trabajo',
      description: 'Chat, tareas, docs y calendario conviven en un mismo lugar. Sin saltar entre herramientas.',
    },
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: 'IA que conoce tu proyecto',
      description: 'El asistente IA tiene acceso a tus tareas, miembros, documentos y mensajes. Respuestas contextuales, no genéricas.',
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: 'Sin costos ocultos por usuario',
      description: 'Precio por proyecto, no por asiento. Añade a todo tu equipo sin que la factura se dispare.',
    },
    {
      icon: <Link2 className="h-6 w-6" />,
      title: 'Integración real con Google Calendar',
      description: 'No solo importa eventos: sincronización bidireccional en tiempo real para mantener a todos alineados.',
    },
  ];

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)]">
      {/* Header */ }
      <header className="sticky top-0 z-50 border-b border-[var(--text-secondary)]/20 bg-[var(--bg-primary)]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="secondary" size="sm" onClick={ () => router.push('/auth') }>
              Iniciar sesión
            </Button>
            <Button size="sm" onClick={ () => router.push('/auth') }>
              Empezar gratis
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */ }
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-[var(--accent-primary)]/10 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-[var(--accent-primary)]/8 blur-3xl" />
        </div>
        <div className="relative container mx-auto px-4 py-24 md:py-36 text-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Chat · Proyectos · Calendario · IA — todo en uno
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold text-[var(--text-primary)] mb-6 leading-tight tracking-tight">
            El workspace que tu
            <br />
            <span className="text-[var(--accent-primary)]">equipo necesitaba</span>
          </h1>
          <p className="text-xl text-[var(--text-secondary)] mb-10 max-w-2xl mx-auto leading-relaxed">
            Chat, proyectos, calendario e IA en una sola plataforma. Menos fricción, más foco en el trabajo del equipo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={ () => router.push('/auth') } className="gap-2 px-8">
              Crear cuenta gratis <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="secondary" onClick={ () => {
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            } }>
              Ver funciones
            </Button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-4">Sin tarjeta de crédito. Plan gratuito real.</p>
        </div>
      </section>

      {/* Stats bar */ }
      <section className="border-y border-[var(--text-secondary)]/15 bg-[var(--bg-secondary)]">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            { stats.map((stat, i) => (
              <div key={ i }>
                <p className="text-2xl font-bold text-[var(--accent-primary)]">{ stat.value }</p>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">{ stat.label }</p>
              </div>
            )) }
          </div>
        </div>
      </section>

      {/* Why Veenzo */ }
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <h2 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
            ¿Por qué Veenzo?
          </h2>
          <p className="text-[var(--text-secondary)] text-lg">
            Un workspace pensado para liderar y operar equipos sin fricción.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          { whyVeenzo.map((item, i) => (
            <div key={ i } className="flex gap-4 p-6 rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)]/40 transition-colors">
              <div className="shrink-0 w-12 h-12 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
                { item.icon }
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">{ item.title }</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{ item.description }</p>
              </div>
            </div>
          )) }
        </div>
      </section>

      {/* Features */ }
      <section id="features" className="bg-[var(--bg-secondary)] py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
              Todo lo que necesitas, sin plugins
            </h2>
            <p className="text-[var(--text-secondary)] text-lg">
              Cada función fue diseñada para fluir junto a las demás.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            { features.map((feature, i) => (
              <div
                key={ i }
                className="group p-6 rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] hover:border-[var(--accent-primary)]/50 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] mb-4 group-hover:bg-[var(--accent-primary)]/20 transition-colors">
                  { feature.icon }
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{ feature.title }</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{ feature.description }</p>
              </div>
            )) }
          </div>
        </div>
      </section>

      {/* Benefits */ }
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <h2 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
            Todo lo que tu equipo necesita
          </h2>
          <p className="text-[var(--text-secondary)] text-lg">
            Chat, tareas, docs, calendario e IA en un solo workspace.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          { benefits.map((benefit, i) => (
            <div
              key={ i }
              className="flex gap-3 p-5 rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)]"
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
                { benefit.icon }
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-0.5">{ benefit.title }</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{ benefit.description }</p>
              </div>
            </div>
          )) }
        </div>
      </section>

      {/* Plans preview */ }
      <section className="bg-[var(--bg-secondary)] py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
              Comienza gratis, escala cuando crezcas
            </h2>
            <p className="text-[var(--text-secondary)] text-lg">
              Sin sorpresas en la factura. Sin pagar por cada usuario extra.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            { plans.map((plan, i) => (
              <div
                key={ i }
                className={ `relative rounded-xl border p-6 flex flex-col transition-all ${plan.highlighted
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-lg'
                  : 'border-[var(--text-secondary)]/20 bg-[var(--bg-primary)]'
                  }` }
              >
                { plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)]">
                    Más popular
                  </span>
                ) }
                <div className="flex items-center mb-3 flex-col">
                  <span className="text-[var(--accent-primary)] flex gap-1">{ plan.icon }</span>
                  <h3 className="font-bold text-[var(--text-primary)] text-lg">{ plan.name }</h3>
                </div>
                <p className="text-sm text-center text-[var(--text-secondary)] mb-5">{ plan.description }</p>
                <ul className="space-y-2 mb-6 flex-1">
                  { plan.features.map((f, j) => (
                    <li key={ j } className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                      <Check className="h-4 w-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                      { f }
                    </li>
                  )) }
                </ul>
                <Button
                  variant={ plan.highlighted ? 'primary' : 'secondary' }
                  className="w-full mt-auto"
                  onClick={ () => router.push('/auth') }
                >
                  { plan.cta }
                </Button>
              </div>
            )) }
          </div>
        </div>
      </section>

      {/* Testimonial-style CTA */ }
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto rounded-2xl bg-[var(--accent-primary)] p-12 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative">
            <div className="flex justify-center gap-1 mb-4">
              { Array.from({ length: 5 }).map((_, i) => (
                <Star key={ i } className="h-5 w-5 fill-[var(--accent-primary-contrast)] text-[var(--accent-primary-contrast)]" />
              )) }
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--accent-primary-contrast)] mb-4">
              Todo tu equipo, en un solo lugar
            </h2>
            <p className="text-lg text-[var(--accent-primary-contrast)]/80 mb-8 max-w-2xl mx-auto">
              Un solo workspace para chat, gestión de proyectos, documentación, calendario y asistente IA. Empieza gratis hoy.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                variant="secondary"
                onClick={ () => router.push('/auth') }
                className="gap-2 px-8"
              >
                Crear cuenta gratis <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-[var(--accent-primary-contrast)]/60 mt-4">Sin tarjeta de crédito · Cancela cuando quieras</p>
          </div>
        </div>
      </section>

      {/* Footer */ }
      <footer className="border-t border-[var(--text-secondary)]/20 py-10 bg-[var(--bg-secondary)]">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-xs text-[var(--text-secondary)]">&copy; 2026 Veenzo. Todos los derechos reservados.</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="/privacy" className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors">
                Privacidad
              </a>
              <a href="/terms" className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors">
                Términos
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
