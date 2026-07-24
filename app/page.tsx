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
  Users, FileText, Bell, Rocket, UserPlus, Bot,
} from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { ProductPreview } from '@/components/landing/ProductPreview';

type PlanTier = 'free' | 'starter' | 'pro';

type PlanLimits = {
  max_storage_bytes?: number;
};

type CatalogPlan = {
  provider: 'lemon_squeezy' | 'local';
  plan_code: PlanTier;
  name: string;
  description: string | null;
  features: string[];
  limits?: PlanLimits;
  external_id?: string;
  checkout_url?: string | null;
};

type PlansByProvidersResponse = {
  free?: CatalogPlan;
  lemon_squeezy?: CatalogPlan[];
  all_lemon_squeezy?: CatalogPlan[];
};

type LemonVariantResponse = {
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
  features: string[];
  description: string | null;
  name: string;
};

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function formatLemonPrice(price?: string) {
  if (!price) return null;
  return price.replace(/month/gi, 'mes');
}

function isStorageFeature(feature: string) {
  const lower = feature.toLowerCase();
  return lower.includes('recurso') || (lower.includes('gb') && lower.includes('hasta'));
}

function formatStorageLabel(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    const rounded = Number.isInteger(gb) ? gb : Number(gb.toFixed(1));
    return `${rounded} GB`;
  }
  const mb = bytes / (1024 * 1024);
  const rounded = Number.isInteger(mb) ? mb : Number(mb.toFixed(0));
  return `${rounded} MB`;
}

/** Keep quotas first and guarantee the storage line stays in the visible list. */
function prioritizeLandingFeatures(features: string[], max = 4) {
  if (features.length <= max) return features;
  const storage = features.find(isStorageFeature);
  const rest = features.filter((f) => !isStorageFeature(f));
  if (!storage) return features.slice(0, max);
  return [rest[0], storage, ...rest.slice(1)].filter(Boolean).slice(0, max);
}

function withProStorageOptions(features: string[], proVariants: CatalogPlan[]) {
  const storageBytes = [
    ...new Set(
      proVariants
        .map((plan) => plan.limits?.max_storage_bytes)
        .filter((value): value is number => typeof value === 'number' && value > 0),
    ),
  ].sort((a, b) => a - b);

  const labels = storageBytes.map(formatStorageLabel);
  const storageLine =
    labels.length > 1
      ? `Hasta ${labels.join(' o ')} de recursos`
      : labels.length === 1
        ? `Hasta ${labels[0]} de recursos`
        : 'Hasta 5 GB o 10 GB de recursos';

  const withoutStorage = features.filter((f) => !isStorageFeature(f));
  if (withoutStorage.length === 0) return [storageLine];
  return [withoutStorage[0], storageLine, ...withoutStorage.slice(1)];
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
    queryFn: async (): Promise<{
      free?: CatalogPlan;
      paid: Partial<Record<'starter' | 'pro', LemonPlanDetails>>;
    }> => {
      const res = await fetch('/api/plans');
      if (!res.ok) {
        throw new Error('Error cargando planes');
      }

      const plansByProvider = (await res.json()) as PlansByProvidersResponse;
      const lemonPlans = plansByProvider.lemon_squeezy ?? [];
      const allLemonPlans = plansByProvider.all_lemon_squeezy ?? lemonPlans;
      const paid: Partial<Record<'starter' | 'pro', LemonPlanDetails>> = {};

      await Promise.all(
        lemonPlans.map(async (plan) => {
          if (plan.plan_code !== 'starter' && plan.plan_code !== 'pro') {
            return;
          }
          if (!plan.external_id) return;

          const features =
            plan.plan_code === 'pro'
              ? withProStorageOptions(
                  plan.features,
                  allLemonPlans.filter((p) => p.plan_code === 'pro'),
                )
              : plan.features;

          const variantRes = await fetch(
            `/api/lemon-squeezy/variant/${plan.external_id}`,
          );
          if (!variantRes.ok) {
            paid[plan.plan_code] = {
              price: undefined,
              hasFreeTrial: false,
              trialDays: 0,
              features,
              description: plan.description,
              name: plan.name,
            };
            return;
          }

          const variant = (await variantRes.json()) as LemonVariantResponse;

          paid[plan.plan_code] = {
            price: formatLemonPrice(variant.price) ?? undefined,
            hasFreeTrial: Boolean(variant.hasFreeTrial),
            trialDays: variant.trialDays ?? 0,
            features,
            description: plan.description,
            name: plan.name,
          };
        }),
      );

      return { free: plansByProvider.free, paid };
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
    const free = lemonPlanDetails?.free;
    const starter = lemonPlanDetails?.paid?.starter;
    const pro = lemonPlanDetails?.paid?.pro;
    const MAX_FEATURES = 4;

    const toPlan = (
      tier: PlanTier,
      opts: {
        name: string;
        price: string;
        priceLoading: boolean;
        trialLabel: string | null;
        description: string;
        icon: React.ReactNode;
        features: string[];
        cta: string;
        highlighted: boolean;
      },
    ) => {
      const features = prioritizeLandingFeatures(opts.features, MAX_FEATURES);
      const moreCount = Math.max(0, opts.features.length - features.length);
      return { tier, ...opts, features, moreCount };
    };

    return [
      toPlan('free', {
        name: free?.name ?? 'Free',
        price: 'Gratis',
        priceLoading: false,
        trialLabel: null,
        description: free?.description ?? 'Para empezar sin costo',
        icon: <Zap className="h-4 w-4" />,
        features: free?.features?.length
          ? free.features
          : [
              '3 proyectos',
              'Chat ilimitado',
              '100 MB de recursos',
              'Hasta 10 miembros/proyecto',
            ],
        cta: 'Comenzar gratis',
        highlighted: false,
      }),
      toPlan('starter', {
        name: starter?.name ?? 'Starter',
        price: starter?.price ?? 'Por proyecto',
        priceLoading: lemonPlansLoading,
        trialLabel:
          starter?.hasFreeTrial && starter.trialDays > 0
            ? `${starter.trialDays} días de prueba gratis`
            : null,
        description: starter?.description ?? 'Para equipos en crecimiento',
        icon: <Sparkles className="h-4 w-4" />,
        features: starter?.features?.length
          ? starter.features
          : [
              '5 proyectos',
              'Chat ilimitado',
              '1 GB de recursos',
              'Hasta 15 miembros/proyecto',
              'Soporte prioritario',
            ],
        cta: 'Empezar con Starter',
        highlighted: false,
      }),
      toPlan('pro', {
        name: pro?.name ?? 'Pro',
        price: pro?.price ?? 'Por proyecto',
        priceLoading: lemonPlansLoading,
        trialLabel:
          pro?.hasFreeTrial && pro.trialDays > 0
            ? `${pro.trialDays} días de prueba gratis`
            : null,
        description: pro?.description ?? 'Para quien lidera equipos',
        icon: <Sparkles className="h-4 w-4" />,
        features: pro?.features?.length
          ? pro.features
          : [
              '10 proyectos',
              'Hasta 5 GB o 10 GB de recursos',
              'Hasta 30 miembros/proyecto',
              'Asistente IA + analítica avanzada',
              'Workspace multi-proyecto',
            ],
        cta: 'Empezar con Pro',
        highlighted: true,
      }),
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

  const howItWorks = [
    {
      step: '01',
      icon: <Rocket className="h-5 w-5" />,
      title: 'Crea tu proyecto',
      description: 'Armá el espacio en minutos: tareas, calendario y docs en un solo lugar.',
    },
    {
      step: '02',
      icon: <UserPlus className="h-5 w-5" />,
      title: 'Invita al equipo',
      description: 'Sumá miembros sin pagar por asiento. Todos colaboran desde el mismo workspace.',
    },
    {
      step: '03',
      icon: <Bot className="h-5 w-5" />,
      title: 'Dejá que la IA ayude',
      description: 'Resúmenes, tareas y respuestas con contexto real de tu proyecto.',
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
              onClick={ () => scrollToId('how-it-works') }
              className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
            >
              Cómo funciona
            </button>
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
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={ {
              backgroundImage:
                'radial-gradient(circle at 1px 1px, var(--text-primary) 1px, transparent 0)',
              backgroundSize: '28px 28px',
            } }
          />
        </div>
        <div className="relative container mx-auto px-4 pt-20 pb-16 md:pt-28 md:pb-24 text-center">
          <p className="landing-fade-up mb-4 text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--accent-primary)]">
            Veenzo
          </p>
          <h1 className="landing-fade-up landing-fade-up-delay-1 text-4xl md:text-6xl font-extrabold text-[var(--text-primary)] mb-5 leading-tight tracking-tight">
            El workspace que tu equipo necesitaba
          </h1>
          <p className="landing-fade-up landing-fade-up-delay-2 text-lg md:text-xl text-[var(--text-secondary)] mb-8 max-w-2xl mx-auto leading-relaxed">
            Chat, kanban, calendario e IA en un solo lugar. Menos fricción, más foco.
          </p>
          <div className="landing-fade-up landing-fade-up-delay-3 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={ () => router.push('/auth') } className="gap-2 px-8">
              Crear cuenta gratis <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="secondary" onClick={ () => scrollToId('how-it-works') }>
              Cómo funciona
            </Button>
          </div>
          <p className="landing-fade-up landing-fade-up-delay-3 text-xs text-[var(--text-secondary)] mt-4">
            Sin tarjeta de crédito. Plan gratuito real.
          </p>
          <div className="landing-fade-up landing-fade-up-delay-3">
            <ProductPreview />
          </div>
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

      {/* How it works */ }
      <section id="how-it-works" className="container mx-auto px-4 py-24">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <h2 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
            Cómo funciona
          </h2>
          <p className="text-[var(--text-secondary)] text-lg">
            Tres pasos para tener al equipo alineado.
          </p>
        </div>
        <div className="relative mx-auto grid max-w-5xl gap-10 md:grid-cols-3 md:gap-8">
          <div
            className="pointer-events-none absolute top-8 right-[16%] left-[16%] hidden h-px bg-[var(--text-secondary)]/20 md:block"
            aria-hidden
          />
          { howItWorks.map((item, i) => (
            <div key={ i } className="relative text-center md:text-left">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] md:mx-0">
                { item.icon }
              </div>
              <p className="mb-1 text-xs font-bold tracking-widest text-[var(--accent-primary)]">
                { item.step }
              </p>
              <h3 className="mb-2 text-xl font-semibold text-[var(--text-primary)]">{ item.title }</h3>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{ item.description }</p>
            </div>
          )) }
        </div>
      </section>

      {/* Why Veenzo */ }
      <section className="bg-[var(--bg-secondary)] py-24">
        <div className="container mx-auto px-4">
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
              <div key={ i } className="flex flex-col gap-4 p-6 rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] hover:border-[var(--accent-primary)]/40 transition-colors">
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
        </div>
      </section>

      {/* Features */ }
      <section id="features" className="py-24">
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
                className="group p-6 rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)]/50 hover:shadow-lg transition-all"
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
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-bold text-[var(--text-primary)] mb-3">
            Comienza gratis, escala cuando crezcas
          </h2>
          <p className="text-[var(--text-secondary)] text-lg">
            Precio por proyecto, no por asiento. Elige el plan al crear tu cuenta.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto items-start">
          { plans.map((plan, i) => (
            <div
              key={ i }
              className={ `relative rounded-xl border px-5 py-5 flex flex-col gap-3 transition-all ${plan.highlighted
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-lg'
                : 'border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)]'
                }` }
            >
              { plan.highlighted && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)]">
                  Más popular
                </span>
              ) }

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[var(--accent-primary)] shrink-0">{ plan.icon }</span>
                  <h3 className="font-bold text-[var(--text-primary)] text-base truncate">{ plan.name }</h3>
                </div>
                <div className="shrink-0 text-right">
                  { plan.priceLoading ? (
                    <div className="h-6 w-20 animate-pulse rounded bg-[var(--text-secondary)]/15 ml-auto" />
                  ) : (
                    <p className="text-lg font-extrabold text-[var(--text-primary)] leading-tight">{ plan.price }</p>
                  ) }
                </div>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-snug">{ plan.description }</p>
              { plan.trialLabel && (
                <p className="text-[11px] font-medium text-[var(--accent-primary)] -mt-1">
                  { plan.trialLabel }
                </p>
              ) }

              <ul className="space-y-1.5">
                { plan.features.map((f, j) => (
                  <li key={ j } className="flex items-start gap-2 text-xs text-[var(--text-secondary)] leading-snug">
                    <Check className="h-3.5 w-3.5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                    { f }
                  </li>
                )) }
                { plan.moreCount > 0 && (
                  <li className="text-[11px] text-[var(--text-secondary)]/80 pl-5">
                    +{ plan.moreCount } beneficios más al registrarte
                  </li>
                ) }
              </ul>

              <Button
                variant={ plan.highlighted ? 'primary' : 'secondary' }
                size="sm"
                className="w-full mt-1"
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
