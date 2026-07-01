'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, CheckCircle2, Loader2, Star, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

type Provider = 'lemon_squeezy';

type PlanResponse = {

  name: string;
  price?: string;
  buy_url?: string;
  description?: string;
  hasFreeTrial: boolean;
  trialDays: number;
};

type PlanTier = 'free' | 'starter' | 'pro';

type PlanCardProps = {
  external_id?: string;
  provider?: Provider;
  forceTier?: PlanTier;
  isCurrent: boolean;
  isCanceled: boolean;
  payerEmail?: string;
  payerId?: string;
};

const PLAN_CONTENT: Record<PlanTier, { icon: React.ReactNode; description: string; features: string[]; }> = {
  free: {
    icon: <Zap className='h-8 w-8' />,
    description: 'Perfecto para comenzar',
    features: [
      'Hasta 3 proyectos',
      'Canales y chat ilimitados',
      'Hasta 100 MB de recursos',
      'Hasta 10 miembros por proyecto',
      'Soporte por email',
    ]
  },
  starter: {
    icon: <Star className='h-8 w-8' />,
    description: 'Para usuarios intermedios',
    features: [
      'Hasta 5 proyectos',
      'Canales y chat ilimitados',
      'Hasta 1 GB de recursos',
      'Hasta 15 miembros por proyecto',
      'Soporte prioritario',
    ]
  },
  pro: {
    icon: (
      <>
        <Star className='h-8 w-8' />
        <Star className='h-8 w-8' />
      </>
    ),
    description: 'Para usuarios avanzados',
    features: [
      'Hasta 10 proyectos',
      'Canales y chat ilimitados',
      'Hasta 5 GB de recursos',
      'Hasta 20 miembros por proyecto',
      'Asistente IA con Gemini',
      'Generar tareas con IA',
      'Resúmenes de chat con IA',
      'Almacenamiento prioritario',
      'Soporte prioritario',
      'Integraciones avanzadas',
      'Exportar datos',
      'Analítica avanzada de proyectos con IA',
    ]
  },
};

function inferTierFromPlanName(name?: string): PlanTier {
  const normalized = (name ?? '').toLowerCase();
  if (normalized.includes('pro')) return 'pro';
  if (normalized.includes('starter')) return 'starter';
  return 'free';
}

export default function PlanCard({
  external_id,
  provider,
  forceTier,
  isCurrent,
  isCanceled,
  payerEmail,
  payerId,
}: PlanCardProps) {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState<'form' | 'processing' | 'success'>('form');

  const shouldFetchPlan = Boolean(external_id && provider === 'lemon_squeezy');
  const { data: plan, isLoading, error } = useQuery<PlanResponse>({
    queryKey: ['plan', external_id ?? 'local', forceTier ?? 'auto'],
    queryFn: async () => {
      const endpoint = `/api/lemon-squeezy/product/${external_id}`;

      const res = await fetch(endpoint, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Error fetching plan data');
      }

      return res.json();
    },
    enabled: shouldFetchPlan,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const isLoadingState = shouldFetchPlan && isLoading;
  const hasPlanDataError = shouldFetchPlan && !isLoadingState && !!error;
  const canRenderLocalFree = !shouldFetchPlan && forceTier === 'free';
  const canRenderPlan = (!isLoadingState && !hasPlanDataError && !!plan) || canRenderLocalFree;
  let effectiveTier: PlanTier;

  if (plan?.name) {
    effectiveTier = inferTierFromPlanName(plan.name);
  } else if (forceTier) {
    effectiveTier = forceTier;
  } else {
    // Safe fallback when no tier hint is available.
    effectiveTier = 'free';
  }

  const planConfig: typeof PLAN_CONTENT[PlanTier] | undefined = PLAN_CONTENT[effectiveTier];

  const isFree = effectiveTier === 'free';
  const isPro = effectiveTier === 'pro';
  const displayPlanName = plan?.name ?? effectiveTier.toUpperCase();
  const displayDescription = plan?.description || planConfig.description;
  const displayPriceText = isFree ? 'Gratis' : (plan?.price || '$0/mes');
  const isCheckoutProcessing = checkoutState === 'processing';

  const isActionDisabled =
    isLoadingState ||
    isCheckoutProcessing ||
    isFree ||
    (isCurrent && !isCanceled);

  const handlePlanAction = async () => {
    if (isCurrent && isCanceled) {
      // Plan cancelado, proceder al checkout para reactivar
      setCheckoutState('form');
      setIsCheckoutOpen(true);
    } else if (isCurrent && !isCanceled) {
      // Plan activo, no hacer nada
      setCheckoutState('form');
      setIsCheckoutOpen(true);
    } else if (!isCurrent) {
      // No es el plan actual, proceder al checkout
      setCheckoutState('form');
      setIsCheckoutOpen(true);
    }
  };

  const renderCheckout = () => {
    if (provider === 'lemon_squeezy') {
      return (
        <div className='rounded-lg border border-[var(--text-secondary)]/20 p-4'>
          <p className='mb-3 text-sm text-[var(--text-secondary)]'>
            Seras redirigido a Lemon Squeezy para completar el pago.
          </p>
          <Button
            className='w-full'
            type='button'
            onClick={ () => {
              if (plan?.buy_url) {
                const params = new URLSearchParams({
                  'checkout[email]': payerEmail as string,
                  'checkout[custom][user_id]': payerId as string,
                });
                window.location.href = `${plan.buy_url}?${params.toString()}`;
              }
            } }
            disabled={ isCheckoutProcessing || !plan?.buy_url }
          >
            Continuar con Lemon Squeezy
          </Button>
        </div>
      );
    }


  };

  return (
    <div className='relative h-full md:min-w-md md:max-w-md'>
      { isLoadingState && (
        <div className='flex min-h-80 items-center justify-center rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-6'>
          <div className='text-center'>
            <div className='mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-b-2 border-[var(--accent-primary)]' />
            <p className='text-sm text-[var(--text-secondary)]'>Cargando plan...</p>
          </div>
        </div>
      ) }

      { hasPlanDataError && (
        <div className='flex min-h-80 items-center justify-center rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-6'>
          <div className='text-center'>
            <p className='mb-2 font-bold text-[var(--accent-danger)]'>No se pudo cargar el plan</p>
            <p className='text-xs text-[var(--text-secondary)]'>Intenta recargar la pagina o contacta soporte.</p>
          </div>
        </div>
      ) }

      { canRenderPlan && (
        <div
          className={ `relative flex h-full flex-col rounded-xl border p-6 transition-all ${isPro
            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-lg'
            : 'border-[var(--text-secondary)]/20 bg-[var(--bg-primary)]'
            }` }
        >
          { isPro && (
            <span className='absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--accent-primary)] px-3 py-1 text-xs font-bold text-[var(--accent-primary-contrast)]'>
              Mas popular
            </span>
          ) }

          { isCurrent && (
            <div
              className={ `absolute right-3 top-3 rounded-full px-2 py-1 text-xs font-bold ${isCanceled
                ? 'bg-[var(--accent-danger)]/20 text-[var(--accent-danger)]'
                : 'bg-green-500/20 text-green-700'
                }` }
            >
              { isCanceled ? 'Cancelado' : 'Plan actual' }
            </div>
          ) }

          <div className='mb-3 flex flex-col items-center gap-2'>
            <span className='flex text-[var(--accent-primary)]'>{ planConfig.icon }</span>
            <h3 className='text-lg font-bold uppercase text-[var(--text-primary)]'>{ displayPlanName }</h3>
          </div>

          <p className='mb-1 text-3xl font-extrabold text-[var(--text-primary)]'>{ displayPriceText }</p>

          <p className='mb-1 text-sm text-[var(--text-secondary)]'>{ displayDescription }</p>

          { plan?.hasFreeTrial && plan?.trialDays > 0 && (
            <p className='mt-1 text-xs font-medium text-[var(--accent-primary)]'>
              Incluye { plan.trialDays } días de prueba gratis
            </p>
          ) }

          <ul className='mb-6 mt-3 space-y-2'>
            { planConfig.features.map((feature) => (
              <li key={ feature } className='flex items-start gap-2 text-sm text-[var(--text-secondary)]'>
                <Check className='mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]' />
                { feature }
              </li>
            )) }
          </ul>
          { !isFree &&
            <Button
              className='mt-auto w-full'
              variant={ isCurrent && !isCanceled ? 'primary' : 'secondary' }
              disabled={ isActionDisabled }
              onClick={ () => void handlePlanAction() }
            >
              { isFree
                ? 'Ya estas aquí'
                : isCurrent
                  ? (isCanceled ? 'Reactivar suscripción' : 'Plan actual')
                  : 'Actualizar plan' }
            </Button>
          }
          { !isFree && isCheckoutOpen && (
            <Modal
              isOpen={ isCheckoutOpen }
              onClose={ () => !isCheckoutProcessing && setIsCheckoutOpen(false) }
              title={ `Checkout ${displayPlanName}` }
              size='lg'
            >
              { checkoutState === 'success' ? (
                <div className='p-6 text-center'>
                  <CheckCircle2 className='mx-auto h-12 w-12 text-emerald-500' />
                  <h4 className='font-bold'>Pago confirmado</h4>
                </div>
              ) : (
                <div className='relative'>
                  { renderCheckout() }
                  { isCheckoutProcessing && (
                    <div className='absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]/85'>
                      <Loader2 className='mx-auto h-8 w-8 animate-spin text-[var(--accent-primary)]' />
                    </div>
                  ) }
                </div>
              ) }
            </Modal>
          ) }
        </div>
      ) }
    </div>
  );
}
