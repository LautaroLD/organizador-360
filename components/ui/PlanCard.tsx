'use client';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Loader2, Star, Zap } from 'lucide-react';
import { Button } from './Button';
import { resolveEffectivePlanTier } from '@/lib/subscriptionUtils';
import MercadoPagoCardBrick from './MercadoPagoCardBrick';
import { Modal } from './Modal';
import { toast } from 'react-toastify';

type PlanResponse = {
  reason?: string;
  auto_recurring?: {
    transaction_amount?: number;
    frequency_type?: string;
    frequency?: number;
    free_trial?: {
      frequency?: number;
    };
  };
};

export default function PlanCard({
  planId,
  isCurrent,
  isCanceled,
  plan_reference,
  payerEmail,
  onSubscriptionCreated,
  onSubscriptionReactivated,
}: {
  planId: string;
  isCurrent: boolean;
  isCanceled: boolean;
  plan_reference: string;
  payerEmail?: string;
  onSubscriptionCreated?: (subscriptionId: string) => Promise<void> | void;
  onSubscriptionReactivated?: () => Promise<void> | void;
}) {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [checkoutState, setCheckoutState] = useState<
    'form' | 'processing' | 'success'
  >('form');

  const { data: plan, isLoading, error } = useQuery<PlanResponse>({
    queryKey: ['plan', planId],
    queryFn: async () => {
      const res = await fetch(`/api/mercadopago/plan/${planId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Error fetching plan data');
      }
      return res.json();
    },
    enabled: !!planId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
  const isPlanIdMissing = !planId;
  const isLoadingState = isLoading;

  const planFeatures: Record<string, { icon: React.ReactNode; description: string; features: string[]; }> = {
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
      icon: <>
        <Star className='h-8 w-8' />
      </>,
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
      icon: <>
        <Star className='h-8 w-8' />
        <Star className='h-8 w-8' />
      </>,
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
    enterprise: {
      icon: <>
        <Star className='h-8 w-8' />
        <Star className='h-8 w-8' />
        <Star className='h-8 w-8' />
      </>,
      description: 'Para grandes equipos y empresas',
      features: [
        'Proyectos ilimitados',
        'Canales y chat ilimitados',
        'Recursos ilimitados',
        'Miembros ilimitados por proyecto',
        'Asistente IA con Gemini',
        'Generar tareas con IA',
        'Resúmenes de chat con IA',
        'Analítica avanzada de proyectos con IA',
        'Almacenamiento prioritario',
        'Soporte 24/7',
        'Integraciones avanzadas',
        'Exportar datos',
        'Gestión de cuentas dedicada',
      ]
    }
  };
  function inferTierFromReference(planRef: string): 'free' | 'starter' | 'pro' | 'enterprise' {
    const ref = planRef.toLowerCase();
    if (ref.includes('free')) return 'free';
    if (ref.includes('starter')) return 'starter';
    if (ref.includes('enterprise')) return 'enterprise';
    return 'pro';
  }
  const planReason = (!isLoadingState && plan && typeof plan.reason === 'string') ? plan.reason : '';
  const type = resolveEffectivePlanTier({
    planTier: inferTierFromReference(plan_reference),
    internalPlanTier: planReason,
  });
  const features = planFeatures[type]?.features || [];
  const icon = planFeatures[type]?.icon || <Star className='h-8 w-8' />;
  const description = planFeatures[type]?.description || '';

  const isFree = type === 'free';
  const amount = Number(plan?.auto_recurring?.transaction_amount ?? 0);

  const isPro = type === 'pro';

  const isCheckoutProcessing = checkoutState === 'processing';

  useEffect(() => {
    if (!isCheckoutOpen || checkoutState !== 'success') return;
    const timer = window.setTimeout(() => {
      setIsCheckoutOpen(false);
      setCheckoutState('form');
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [checkoutState, isCheckoutOpen]);

  const handleReactivate = async () => {
    if (isReactivating) return;
    setIsReactivating(true);
    try {
      const response = await fetch('/api/mercadopago/reactivate-subscription', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo reactivar la suscripción');
      }

      await onSubscriptionReactivated?.();
      toast.success('Suscripción reactivada correctamente');
    } catch {
      setCheckoutState('form');
      setIsCheckoutOpen(true);
      toast.info('No se pudo reactivar. Completa el checkout para suscribirte nuevamente.');
    } finally {
      setIsReactivating(false);
    }
  };

  return (
    <div className='relative w-full h-full'>

      {/* Loading */}
      {isLoadingState && (
        <div className='rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-6 flex items-center justify-center min-h-80'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)] mx-auto mb-3'></div>
            <p className='text-[var(--text-secondary)] text-sm'>Cargando plan...</p>
          </div>
        </div>
      )}

      {!isLoadingState && isPlanIdMissing && (
        <div className='rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-6 flex items-center justify-center min-h-80'>
          <div className='text-center'>
            <p className='text-[var(--accent-danger)] font-bold mb-2'>Plan no disponible</p>
            <p className='text-[var(--text-secondary)] text-xs'>Falta configurar el ID del plan en variables de entorno.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!isLoadingState && !isPlanIdMissing && (!plan || error) && (
        <div className='rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-6 flex items-center justify-center min-h-80'>
          <div className='text-center'>
            <p className='text-[var(--accent-danger)] font-bold mb-2'>No se pudo cargar el plan</p>
            <p className='text-[var(--text-secondary)] text-xs'>Intenta recargar la página o contacta soporte.</p>
          </div>
        </div>
      )}

      {/* Plan cargado */}
      {!isLoadingState && plan && !error && (
        type === 'enterprise' ? (
          /* Enterprise – Próximamente */
          <div className='relative rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-6 flex flex-col items-center justify-center min-h-full transition-all'>
            <div className='flex flex-col items-center gap-2 mb-3'>
              <span className='text-[var(--accent-primary)] flex'>{icon}</span>
              <h3 className='font-bold text-[var(--text-primary)] text-lg uppercase'>{planReason || 'Enterprise'}</h3>
            </div>
            <p className='text-xl font-bold text-[var(--accent-primary)]'>Próximamente</p>
          </div>
        ) : (
          /* Plan normal */
          <div className={`relative rounded-xl border p-6 flex flex-col transition-all h-full ${isPro
            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-lg'
            : 'border-[var(--text-secondary)]/20 bg-[var(--bg-primary)]'
            }`}>
            {/* Badge "Más popular" para Pro */}
            {isPro && (
              <span className='absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] whitespace-nowrap'>
                Más popular
              </span>
            )}

            {/* Badge plan actual */}
            {isCurrent && (
              <div className={`absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded-full ${isCanceled
                ? 'bg-[var(--accent-danger)]/20 text-[var(--accent-danger)]'
                : 'bg-green-500/20 text-green-700'
                }`}>
                {isCanceled ? 'Cancelado' : 'Plan actual'}
              </div>
            )}

            {/* Nombre e icono */}
            <div className='flex flex-col items-center gap-2 mb-3'>
              <span className='text-[var(--accent-primary)] flex'>{icon}</span>
              <h3 className='font-bold text-[var(--text-primary)] text-lg uppercase'>{planReason || 'Plan'}</h3>
            </div>

            {/* Precio */}
            <div className='mb-1'>
              <span className='text-3xl font-extrabold text-[var(--text-primary)]'>
                ${plan.auto_recurring?.transaction_amount?.toLocaleString() ?? '0'}
              </span>
              <span className='text-[var(--text-secondary)] ml-1 text-sm'>
                {plan.auto_recurring?.frequency_type === 'months' && plan.auto_recurring?.frequency === 12 ? '/año' : '/mes'}
              </span>
            </div>

            {/* Descripción */}
            <p className='text-sm text-[var(--text-secondary)] mb-1'>{description}</p>

            {/* Prueba gratuita */}
            {plan.auto_recurring?.free_trial && (
              <p className='text-xs font-medium text-[var(--accent-primary)] mb-4'>
                ✓ {plan.auto_recurring.free_trial.frequency} días de prueba gratuita
              </p>
            )}

            {/* Features */}
            <ul className='space-y-2 mb-6 flex-1 mt-3'>
              {features.map((feature) => (
                <li key={feature} className='flex items-start gap-2 text-sm text-[var(--text-secondary)]'>
                  <Check className='h-4 w-4 text-[var(--accent-primary)] shrink-0 mt-0.5' />
                  {feature}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Button
              className='w-full mt-auto'
              variant={isCurrent && !isCanceled ? 'primary' : 'secondary'}
              disabled={(isCurrent && !isCanceled) || isLoadingState || isFree || isReactivating}
              onClick={() => {
                if (!isFree && isCurrent && isCanceled) {
                  void handleReactivate();
                  return;
                }
                if (!isFree && !isCurrent) {
                  setCheckoutState('form');
                  setIsCheckoutOpen(true);
                }
              }}
            >
              {isFree
                ? 'Ya estás aquí'
                : isLoadingState && isCurrent
                  ? 'Procesando...'
                  : isCurrent
                    ? (isCanceled ? (isReactivating ? 'Reactivando...' : 'Reactivar suscripción') : 'Plan actual')
                    : 'Actualizar plan'}
            </Button>

            {!isFree && amount > 0 && isCheckoutOpen && (
              <Modal
                isOpen={isCheckoutOpen}
                onClose={() => {
                  if (isCheckoutProcessing) return;
                  setIsCheckoutOpen(false);
                  setCheckoutState('form');
                }}
                title={`Checkout ${planReason || 'Plan'}`}
                size='lg'
              >
                <div className='space-y-3'>
                  <p className='text-sm text-[var(--text-secondary)]'>
                    Completa los datos de tu tarjeta para activar tu suscripción.
                  </p>
                  <p className='text-sm font-semibold text-[var(--text-primary)]'>
                    Total: ${amount.toLocaleString()} /{' '}
                    {plan.auto_recurring?.frequency_type === 'months' && plan.auto_recurring?.frequency === 12 ? 'año' : 'mes'}
                  </p>
                </div>

                {checkoutState === 'success' ? (
                  <div className='mt-6 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-6 text-center'>
                    <CheckCircle2 className='mx-auto mb-3 h-12 w-12 text-emerald-500' />
                    <h4 className='text-xl font-bold text-[var(--text-primary)]'>
                      Pago confirmado
                    </h4>
                    <p className='mt-2 text-sm text-[var(--text-secondary)]'>
                      Tu suscripción quedó activa. Estamos actualizando tu panel.
                    </p>
                  </div>
                ) : (
                  <div className='mt-4 relative'>
                    <MercadoPagoCardBrick
                      planId={planId}
                      planName={planReason || 'Plan'}
                      amount={amount}
                      payerEmail={payerEmail}
                      disabled={isCheckoutProcessing}
                      onProcessingChange={(processing) => {
                        setCheckoutState((previous) => {
                          if (previous === 'success') return previous;
                          return processing ? 'processing' : 'form';
                        });
                      }}
                      onCheckoutSuccess={() => {
                        setCheckoutState('success');
                      }}
                      onSubscriptionCreated={async (subscriptionId) => {
                        await onSubscriptionCreated?.(subscriptionId);
                      }}
                    />

                    {isCheckoutProcessing && (
                      <div className='absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[var(--bg-primary)]/85 backdrop-blur-[2px]'>
                        <div className='text-center'>
                          <Loader2 className='mx-auto h-8 w-8 animate-spin text-[var(--accent-primary)]' />
                          <p className='mt-3 text-sm font-semibold text-[var(--text-primary)]'>
                            Confirmando pago...
                          </p>
                          <p className='mt-1 text-xs text-[var(--text-secondary)]'>
                            Esto puede tardar unos segundos.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Modal>
            )}
          </div>
        )
      )}
    </div>
  );
}
