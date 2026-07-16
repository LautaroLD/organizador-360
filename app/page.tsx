'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuthStore } from '@/store/authStore';
import {
  Code2, MessageSquare, FolderKanban, Calendar, Sparkles,
  BarChart3, Check, Zap, ArrowRight,
  Users, FileText, Bell,
} from 'lucide-react';
import Logo from '@/components/ui/Logo';

type PlanTier = 'free' | 'starter' | 'pro';

type ProviderPlan = {
  provider: 'lemon_squeezy';
  external_id: string;
  plan_code?: 'starter' | 'pro';
};

type PlansByProvidersResponse = {
  lemon_squeezy?: ProviderPlan[];
};

type LemonProductResponse = {
  name?: string;
  price?: string;
  hasFreeTrial?: boolean;
  trialDays?: number;
  error?: string;
};

type LemonPlanDetails = {
  price?: string;
  hasFreeTrial: boolean;
  trialDays: number;
};

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function formatLemonPrice(price?: string) {
  if (!price) return null;
  return price.replace(/month/gi, 'mes');
}

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [authLoading, user, router]);

  const { data: lemonPlanDetails, isLoading: lemonPlansLoading } = useQuery({
    queryKey: ['landing-lemon-plans'],
    queryFn: async (): Promise<Partial<Record<'starter' | 'pro', LemonPlanDetails>>> => {
      const res = await fetch('/api/plans');
      if (!res.ok) {
        throw new Error('Error cargando planes');
      }

      const plansByProvider = (await res.json()) as PlansByProvidersResponse;
      const lemonPlans = plansByProvider.lemon_squeezy ?? [];

      const result: Partial<Record<'starter' | 'pro', LemonPlanDetails>> = {};

      await Promise.all(
        lemonPlans.map(async (plan) => {
          if (plan.plan_code !== 'starter' && plan.plan_code !== 'pro') {
            return;
          }

          const productRes = await fetch(`/api/lemon-squeezy/product/${plan.external_id}`);
          if (!productRes.ok) return;

          const product = (await productRes.json()) as LemonProductResponse;
          if (!product.price || product.error) return;

          result[plan.plan_code] = {
            price: formatLemonPrice(product.price) ?? undefined,
            hasFreeTrial: Boolean(product.hasFreeTrial),
            trialDays: product.trialDays ?? 0,
          };
        }),
      );

      return result;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const highlights = [
    { value: 'Precio por proyecto', label: 'Sin costo por asiento' },
    { value: 'Hasta 30 miembros', label: 'En plan Pro' },
    { value: 'IA contextual', label: 'Conoce tu proyecto' },
    { value: '3 planes', label: 'Gratis para empezar' },
  ];

  const features = [
    {
      icon: <MessageSquare className="h-7 w-7" />,
      title: 'Chat en tiempo real',
      description: 'Canales por proyecto. Mensajes instantáneos sin salir del flujo de trabajo.',
    },
    {
      icon: <FolderKanban className="h-7 w-7" />,
      title: 'Kanban + Roadmap',
      description: 'Tableros visuales con fases, prioridades, fechas estimadas y asignaciones.',
    },
    {
      icon: <Calendar className="h-7 w-7" />,
      title: 'Calendario compartido',
      description: 'Eventos del equipo en un solo lugar, con sync bidireccional a Google Calendar.',
    },
    {
      icon: <Code2 className="h-7 w-7" />,
      title: 'Base de conocimiento',
      description: 'Documentos, archivos y links centralizados. Analiza recursos con IA al instante.',
    },
    {
      icon: <Sparkles className="h-7 w-7" />,
      title: 'Asistente IA integrado',
      description: 'Genera tareas, resúmenes de chat y respuestas con contexto del proyecto.',
    },
    {
      icon: <BarChart3 className="h-7 w-7" />,
      title: 'Analítica de proyectos',
      description: 'Métricas de progreso, workload y salud del equipo con apoyo de IA.',
    },
    {
      icon: <Bell className="h-7 w-7" />,
      title: 'Notificaciones push',
      description: 'Alertas en tiempo real para no perderte lo importante del proyecto.',
    },
    {
      icon: <Users className="h-7 w-7" />,
      title: 'Workspace de equipo',
      description: 'Directorio multi-proyecto, asignaciones y vista de mando para quien lidera.',
    },
  ];

  const plans = useMemo(() => {
    const starter = lemonPlanDetails?.starter;
    const pro = lemonPlanDetails?.pro;

    return [
      {
        tier: 'free' as PlanTier,
        name: 'Free',
        price: 'Gratis',
        priceLoading: false,
        trialLabel: null as string | null,
        description: 'Para empezar sin costo',
        icon: <Zap className="h-5 w-5" />,
        features: [
          '3 proyectos',
          'Chat ilimitado',
          '100 MB de recursos',
          'Hasta 10 miembros/proyecto',
        ],
        cta: 'Comenzar gratis',
        highlighted: false,
      },
      {
        tier: 'starter' as PlanTier,
        name: 'Starter',
        price: starter?.price ?? 'Por proyecto',
        priceLoading: lemonPlansLoading,
        trialLabel:
          starter?.hasFreeTrial && starter.trialDays > 0
            ? `${starter.trialDays} días de prueba gratis`
            : null,
        description: 'Para equipos en crecimiento',
        icon: <Sparkles className="h-5 w-5" />,
        features: [
          '5 proyectos',
          'Chat ilimitado',
          '1 GB de recursos',
          'Hasta 15 miembros/proyecto',
          'Soporte prioritario',
        ],
        cta: 'Empezar con Starter',
        highlighted: false,
      },
      {
        tier: 'pro' as PlanTier,
        name: 'Pro',
        price: pro?.price ?? 'Por proyecto',
        priceLoading: lemonPlansLoading,
        trialLabel:
          pro?.hasFreeTrial && pro.trialDays > 0
            ? `${pro.trialDays} días de prueba gratis`
            : null,
        description: 'Para quien lidera equipos',
        icon: (
          <>
            <Sparkles className="h-5 w-5" />
            <Sparkles className="h-5 w-5" />
          </>
        ),
        features: [
          '10 proyectos · 30 miembros · 5 GB',
          'Asistente IA + analítica avanzada',
          'Salud del equipo y workload',
          'Workspace y directorio multi-proyecto',
          'Sync Google Calendar y exportar datos',
          'Plantillas, aprobaciones y permisos',
        ],
        cta: 'Empezar con Pro',
        highlighted: true,
      },
    ];
  }, [lemonPlanDetails, lemonPlansLoading]);

  const whyVeenzo = [
    {
      icon: <FileText className="h-6 w-6" />,
      title: 'Precio por proyecto, no por asiento',
      description: 'Invita a todo el equipo sin que la factura crezca con cada persona.',
    },
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: 'IA con contexto real',
      description: 'El asistente usa tus tareas, miembros, docs y mensajes — no respuestas genéricas.',
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Hecho para liderar equipos',
      description: 'Salud del equipo, workload, aprobaciones y workspace multi-proyecto en Pro.',
    },
  ];

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)]">
      {/* Header */ }
      <header className="sticky top-0 z-50 border-b border-[var(--text-secondary)]/20 bg-[var(--bg-primary)]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Logo />
          <nav className="hidden sm:flex items-center gap-6 text-sm">
            <button
              type="button"
              onClick={ () => scrollToId('features') }
              className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
            >
              Funciones
            </button>
            <button
              type="button"
              onClick={ () => scrollToId('pricing') }
              className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
            >
              Planes
            </button>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
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
            Chat · Proyectos · Calendario · IA
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold text-[var(--text-primary)] mb-6 leading-tight tracking-tight">
            El workspace que tu
            <br />
            <span className="text-[var(--accent-primary)]">equipo necesitaba</span>
          </h1>
          <p className="text-xl text-[var(--text-secondary)] mb-10 max-w-2xl mx-auto leading-relaxed">
            Organiza el trabajo del equipo en un solo lugar. Menos fricción, más foco.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={ () => router.push('/auth') } className="gap-2 px-8">
              Crear cuenta gratis <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="secondary" onClick={ () => scrollToId('features') }>
              Ver funciones
            </Button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-4">Sin tarjeta de crédito. Plan gratuito real.</p>
        </div>
      </section>

      {/* Highlights */ }
      <section className="border-y border-[var(--text-secondary)]/15 bg-[var(--bg-secondary)]">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            { highlights.map((item, i) => (
              <div key={ i }>
                <p className="text-lg md:text-xl font-bold text-[var(--accent-primary)]">{ item.value }</p>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">{ item.label }</p>
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
            Tres razones por las que equipos eligen un solo workspace.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          { whyVeenzo.map((item, i) => (
            <div key={ i } className="flex flex-col gap-4 p-6 rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)]/40 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
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
              Todo lo que tu equipo necesita
            </h2>
            <p className="text-[var(--text-secondary)] text-lg">
              Capacidades listas para usar, sin plugins ni herramientas aparte.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
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

      {/* Plans */ }
      <section id="pricing" className="container mx-auto px-4 py-24">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <h2 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
            Comienza gratis, escala cuando crezcas
          </h2>
          <p className="text-[var(--text-secondary)] text-lg">
            Precio por proyecto, no por asiento. Elige el plan al crear tu cuenta.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          { plans.map((plan, i) => (
            <div
              key={ i }
              className={ `relative rounded-xl border p-6 flex flex-col transition-all ${plan.highlighted
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-lg'
                : 'border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)]'
                }` }
            >
              { plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)]">
                  Más popular
                </span>
              ) }
              <div className="flex items-center mb-2 flex-col">
                <span className="text-[var(--accent-primary)] flex gap-1">{ plan.icon }</span>
                <h3 className="font-bold text-[var(--text-primary)] text-lg">{ plan.name }</h3>
              </div>
              <div className="mb-1 min-h-9 flex items-center justify-center">
                { plan.priceLoading ? (
                  <div className="h-7 w-28 animate-pulse rounded bg-[var(--text-secondary)]/15" />
                ) : (
                  <p className="text-2xl font-extrabold text-center text-[var(--text-primary)]">{ plan.price }</p>
                ) }
              </div>
              { plan.trialLabel && (
                <p className="text-xs font-medium text-center text-[var(--accent-primary)] mb-1">
                  { plan.trialLabel }
                </p>
              ) }
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
      </section>

      {/* CTA */ }
      <section className="container mx-auto px-4 pb-24">
        <div className="max-w-4xl mx-auto rounded-2xl bg-[var(--accent-primary)] p-12 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--accent-primary-contrast)] mb-4">
              Empieza gratis hoy
            </h2>
            <p className="text-lg text-[var(--accent-primary-contrast)]/80 mb-8 max-w-2xl mx-auto">
              Crea tu cuenta, invita a tu equipo y organiza el trabajo en minutos.
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={ () => router.push('/auth') }
              className="gap-2 px-8"
            >
              Crear cuenta gratis <ArrowRight className="h-4 w-4" />
            </Button>
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
