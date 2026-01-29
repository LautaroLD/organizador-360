
'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { toast } from 'react-toastify';
import {
  Check,
  Star,
  Zap,
  Users,
  HardDrive,
  Calendar,
  Lock,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Modal } from '../ui/Modal';
import { useRouter } from 'next/navigation';
import { Freehand } from 'next/font/google';
import PlanCard from '../ui/PlanCard';
import clsx from 'clsx';

interface PricingPlan {
  reason: string;
  status: string;
  subscribed: number;
  back_url: string;
  auto_recurring: AutoRecurring;
  collector_id: number;
  init_point: string;
  date_created: Date;
  id: string;
  last_modified: Date;
  external_reference: string;
  application_id: number;
}

interface AutoRecurring {
  frequency: number;
  currency_id: string;
  transaction_amount: number;
  frequency_type: string;
  free_trial: FreeTrial;
  billing_day: number;
}

interface FreeTrial {
  frequency: number;
  frequency_type: string;
}



interface MercadoPagoDetails {
  id: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  reason: string;
  dateCreated: string;
  nextPaymentDate: string | null;
  startDate: string | null;
  endDate: string | null;
  amount: number;
  currency: string;
  frequency: number;
  frequencyType: string;
  hasFreeTrial: boolean;
  freeTrialDays: number;
  chargedQuantity: number;
  pendingChargeQuantity: number;
  totalChargedAmount: number;
  lastChargedDate: string | null;
  paymentMethodId: string | null;
  daysUntilNextPayment: number | null;
  daysUntilEnd: number | null;
  isExpired: boolean;
  isActive: boolean;
  isCancelled: boolean;
  isPaused: boolean;
  isPending: boolean;
}

export const SubscriptionView: React.FC = () => {
  const supabase = createClient();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const router = useRouter();
  // Fetch subscription data from local DB
  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .in('status', ['active', 'authorized', 'trialing', 'canceled', 'cancelled'])
        .order('created', { ascending: false }) // Priorizar la más reciente si hubiera múltiples
        .limit(1)
        .maybeSingle();

      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch detailed subscription info from MercadoPago
  const { data: mpData } = useQuery({
    queryKey: ['subscription-details', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/mercadopago/subscription-details');
      if (!response.ok) return null;
      const data = await response.json();
      return {
        details: data.details as MercadoPagoDetails,
        isPro: data.isPro as boolean,
        internalPlanId: data.internalPlanId as string
      };
    },
    enabled: !!user?.id && !!subscription?.mercadopago_subscription_id,
    staleTime: 60000, // Cache for 1 minute
  });

  const mpDetails = mpData?.details;

  // Mutation para cancelar suscripción
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/mercadopago/cancel-subscription', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al cancelar suscripción');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Suscripción cancelada. Tu plan finalizará al fin del período.');
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id], exact: false });
      queryClient.invalidateQueries({ queryKey: ['subscription-details', user?.id], exact: false });
    },
    onError: (error) => {
      toast.error(error.message || 'Error al cancelar');
    },
  });
  const handleSubscribe = async (init_point: string) => {
    setLoadingCheckout(true);
    router.push(init_point);
  };

  // Configuración dinámica de features e íconos por tipo de plan
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
    pro: {
      icon: <Star className='h-8 w-8' />,
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
      ]
    },
  };

  // Asignar tipo de plan (free/pro/otro) según el nombre o id
  function getPlanType(plan: PricingPlan) {
    if (plan.reason === 'free' || plan.reason.toLowerCase().includes('free')) return 'free';
    // Puedes mejorar esta lógica para detectar otros tipos de planes
    return 'pro';
  }
  const { data: mercadopagoPlans, isLoading: mercadopagoPlansLoading } = useQuery({
    queryKey: ['mercadopago-plans'],
    queryFn: async () => {
      const response = await fetch('/api/mercadopago/plan');
      if (!response.ok) throw new Error('Error fetching plans');
      const data = await response.json();
      console.log(data);
      return data as PricingPlan[];
    }
  });
  console.log(mercadopagoPlans);

  const plans: PricingPlan[] | undefined = !mercadopagoPlansLoading ? mercadopagoPlans : [];

  // Determinar si es Pro: Status activo O (status cancelado Y fecha fin futura)
  const isCanceled = subscription?.status === 'canceled' || subscription?.status === 'cancelled';
  const hasActivePeriod = subscription?.current_period_end
    ? new Date(subscription.current_period_end) > new Date()
    : false;

  // Lógica mejorada: Usar flag del servidor si está disponible, sino fallback a local
  const isPro = mpData?.isPro ?? ((subscription?.status === 'active' || subscription?.status === 'authorized' || subscription?.status === 'trialing') || (isCanceled && hasActivePeriod));

  if (subscriptionLoading) {
    return (
      <div className='flex items-center justify-center h-full p-12'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4'></div>
          <p className='text-[var(--text-secondary)]'>
            Cargando datos de suscripción...
          </p>
        </div>
      </div>
    );
  }
  const pro_mensual_id = process.env.NEXT_PUBLIC_MP_PRO_MENSUAL_PLAN_ID ?? '';
  const pro_anual_id = process.env.NEXT_PUBLIC_MP_PRO_ANUAL_PLAN_ID ?? '';
  return (
    <div className='p-6 max-w-6xl mx-auto'>
      {/* Encabezado */}
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-[var(--text-primary)] mb-2'>
          Planes y Suscripción
        </h1>
        <p className='text-[var(--text-secondary)]'>
          Elige el plan que mejor se adapte a tus necesidades. Pagos procesados por Mercado Pago.
        </p>
      </div>

      {/* Estado actual de suscripción */}
      {isPro && subscription && (
        <Card className='mb-8 border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5'>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div className=' space-y-2'>
                <CardTitle className='flex items-center gap-2'>
                  <Star className='h-5 w-5 text-[var(--accent-primary)]' />
                  {mpDetails?.reason}
                </CardTitle>
                <CardDescription>
                  {mpDetails ? (
                    <span className={`inline-flex items-center gap-2 ${mpDetails.status === 'authorized' ? 'text-green-600' :
                      mpDetails.status === 'paused' ? 'text-[var(--text-warning)]' :
                        mpDetails.status === 'cancelled' ? 'text-[var(--accent-danger)]' :
                          'text-[var(--text-secondary)]'
                      }`}>
                      {mpDetails.statusLabel}
                      {mpDetails.status !== 'cancelled' && mpDetails.daysUntilNextPayment !== null && mpDetails.daysUntilNextPayment <= 7 && (
                        <span className='text-xs bg-[var(--accent-danger)]/10 text-[var(--accent-danger)] px-2 py-0.5 rounded'>
                          {mpDetails.daysUntilNextPayment === 0 ? 'Cobra hoy' :
                            mpDetails.daysUntilNextPayment === 1 ? 'Cobra mañana' :
                              `Próximo cobro en ${mpDetails.daysUntilNextPayment} días`}
                        </span>
                      )}
                    </span>
                  ) : (
                    'Tu suscripción está activa y renovable'
                  )}
                </CardDescription>
              </div>
              <div className='text-right'>
                <div className='text-sm text-[var(--text-secondary)]'>
                  {mpDetails?.nextPaymentDate ? 'Próximo pago:' : 'Próxima renovación:'}
                </div>
                <div className='text-lg font-semibold text-[var(--text-primary)]'>
                  {mpDetails?.nextPaymentDate
                    ? formatDate(mpDetails.nextPaymentDate)
                    : formatDate(subscription.current_period_end)}
                </div>
                {mpDetails?.amount && (
                  <div className='text-sm text-[var(--text-secondary)]'>
                    ${mpDetails.amount.toLocaleString()} {mpDetails.currency}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className='flex flex-col gap-4'>
              {/* Información detallada de MP */}
              {mpDetails && (
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                  <div>
                    <span className='text-[var(--text-secondary)] block'>Pagos realizados</span>
                    <span className='font-medium text-[var(--text-primary)]'>
                      {mpDetails.chargedQuantity} {mpDetails.pendingChargeQuantity > 0 && `(${mpDetails.pendingChargeQuantity} pendiente${mpDetails.pendingChargeQuantity > 1 ? 's' : ''})`}
                    </span>
                  </div>
                  <div>
                    <span className='text-[var(--text-secondary)] block'>Total cobrado</span>
                    <span className='font-medium text-[var(--text-primary)]'>
                      ${mpDetails.totalChargedAmount.toLocaleString()} {mpDetails.currency}
                    </span>
                  </div>
                  {mpDetails.endDate && (
                    <div>
                      <span className='text-[var(--text-secondary)] block'>Fecha de fin</span>
                      <span className='font-medium text-[var(--text-primary)]'>
                        {formatDate(mpDetails.endDate)}
                      </span>
                    </div>
                  )}
                  {mpDetails.paymentMethodId && (
                    <div>
                      <span className='text-[var(--text-secondary)] block'>Método de pago</span>
                      <span className='font-medium text-[var(--text-primary)] capitalize'>
                        {mpDetails.paymentMethodId.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Período y botón cancelar */}
              <div className='flex items-center gap-4 text-sm border-t border-[var(--border-primary)] pt-4'>
                <div>
                  <span className='text-[var(--text-secondary)]'>
                    Período actual: {formatDate(subscription.current_period_start)} a{' '}
                    {formatDate(subscription.current_period_end)}
                  </span>
                </div>
                {!subscription.cancel_at_period_end && (
                  <Button
                    variant='secondary'
                    size='sm'
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar suscripción'}
                  </Button>
                )}
                {subscription.cancel_at_period_end && (
                  <div className='px-3 py-1 bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/30 rounded text-[var(--accent-danger)] text-xs font-medium'>
                    Cancelada al final del período
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid de planes */}
      <div className='gap-6 mb-8'>
        {mercadopagoPlansLoading && (
          <div className='col-span-2 flex items-center justify-center p-12'>
            <div className='text-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4'></div>
              <p className='text-[var(--text-secondary)]'>Cargando planes...</p>
            </div>
          </div>
        )}
        <div className='flex overflow-auto gap-6 mb-8 p-4'>
          <div className='relative w-80 flex-shrink-0'>
            <Card className='h-full flex flex-col border-[var(--accent-primary)]'>
              <CardHeader>
                <div className='flex items-start justify-between mb-2'>
                  <div className='text-[var(--accent-primary)] mx-auto flex gap-2'>{planFeatures.free.icon}</div>
                </div>
                <CardTitle className='text-2xl uppercase'>FREE</CardTitle>
                <CardDescription>{planFeatures.free.description}</CardDescription>
                <div className='mt-2'>
                  <div className='flex items-baseline gap-1'>
                    <span className='text-2xl font-bold text-[var(--text-primary)]'>
                      $0
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='flex-1 flex flex-col'>
                <div className='space-y-3 mb-6 flex-1'>
                  {planFeatures.free.features.map((feature) => (
                    <div
                      key={feature}
                      className='flex items-start gap-3 text-sm text-[var(--text-secondary)]'
                    >
                      <Check className='h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className='space-y-2'>
            <div className='bg-[var(--bg-secondary)] rounded-full flex items-center'>
              <span className={clsx('bg-[var(--accent-primary)] w-full rounded-full text-center text-white')}>MENSUAL</span>
              <span className={clsx('bg-[var(--accent-secondary)] w-full rounded-full text-center text-white')}>ANUAL</span>
            </div>
            <PlanCard planId={pro_mensual_id} isCurrent={isPro && subscription?.mercadopago_plan_id === pro_mensual_id} isCanceled={subscription?.cancel_at_period_end || false} />
            <PlanCard planId={pro_anual_id} isCurrent={isPro && subscription?.mercadopago_plan_id === pro_anual_id} isCanceled={subscription?.cancel_at_period_end || false} />
          </div>
          {/* {plans?.map((plan) => {
            const type = getPlanType(plan);
            const features = planFeatures[type]?.features || [];
            const icon = planFeatures[type]?.icon || <Star className='h-8 w-8' />;
            const description = planFeatures[type]?.description || '';
            // Determinar si este plan es el actual
            const isCurrent = isPro && subscription && plan.reason !== 'free' && (mpDetails?.reason === plan.reason || subscription.mercadopago_plan_id === plan.reason);
            const isFree = plan.reason === 'free';
            return (
              <div key={plan.reason} className='relative w-80 flex-shrink-0'>
                <Card className='h-full flex flex-col border-[var(--accent-primary)]'>
                  <CardHeader>
                    <div className='flex items-start justify-between mb-2'>
                      <div className='text-[var(--accent-primary)] mx-auto flex gap-2'>{plan.external_reference === 'PRO_ANUAL' ? <>{icon} {icon}</> : icon}</div>
                      {isCurrent && (
                        <div className={`text-xs font-bold px-2 py-1 rounded ${isCanceled ? 'bg-[var(--accent-danger)]/20 text-[var(--accent-danger)]' : 'bg-green-500/20 text-green-700'}`}>
                          {isCanceled ? 'CANCELADO (ACTIVO)' : 'ACTUAL'}
                        </div>
                      )}
                    </div>
                    <CardTitle className='text-2xl uppercase'>{plan.reason}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                    {plan.auto_recurring.free_trial &&
                      <div className='w-full mt-2'>
                        <span className='border text-sm border-[var(--accent-success)] bg-[var(--accent-success)]/10 w-full rounded-2xl py-2 inline-block text-center text-[var(--accent-success)]  font-medium uppercase'>
                          {`${plan.auto_recurring.free_trial.frequency} días`} de prueba gratuita
                        </span>
                      </div>
                    }
                    <div className='mt-2'>
                      <div className='flex items-baseline gap-1'>
                        <span className='text-2xl font-bold text-[var(--text-primary)]'>
                          ${plan.auto_recurring.transaction_amount.toLocaleString()}
                        </span>
                        <span className='text-[var(--text-secondary)]'>
                          {plan.reason !== 'free' && (plan.auto_recurring.frequency_type === 'months' && plan.auto_recurring.frequency === 12 ? '/anual' : '/mensual')}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className='flex-1 flex flex-col'>
                    <div className='space-y-3 mb-6 flex-1'>
                      {features.map((feature) => (
                        <div
                          key={feature}
                          className='flex items-start gap-3 text-sm text-[var(--text-secondary)]'
                        >
                          <Check className='h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      className='w-full'
                      disabled={
                        (isCurrent && !isCanceled) || loadingCheckout || isFree
                      }
                      onClick={() => {
                        if (!isFree) handleSubscribe(plan.init_point);
                      }}
                      variant={isCurrent ? 'primary' : 'secondary'}
                    >
                      {isFree
                        ? 'Ya estás aquí'
                        : loadingCheckout && isCurrent
                          ? 'Redirigiendo...'
                          : isCurrent
                            ? (isCanceled ? 'Reactivar Suscripción' : 'Plan actual')
                            : 'Actualizar'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })} */}
        </div>
      </div>

      {/* FAQ / Información adicional */}
      <div className='grid md:grid-cols-2 gap-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <HardDrive className='h-5 w-5' />
              Almacenamiento
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-[var(--text-secondary)]'>
            <p>
              <strong>Gratuito:</strong> Hasta 100 MB por proyecto
            </p>
            <p>
              <strong>Pro:</strong> Hasta 5 GB por proyecto
            </p>
            <p className='text-xs mt-4'>
              El almacenamiento se calcula a partir de tus recursos y archivos
              subidos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Users className='h-5 w-5' />
              Colaboradores
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-[var(--text-secondary)]'>
            <p>
              <strong>Gratuito:</strong> Hasta 10 miembros por proyecto
            </p>
            <p>
              <strong>Pro:</strong> Hasta 20 miembros por proyecto
            </p>
            <p className='text-xs mt-4'>
              Invita a tu equipo a colaborar en proyectos. Los permisos se
              asignan por rol.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Lock className='h-5 w-5' />
              Seguridad
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-[var(--text-secondary)]'>
            <p>✓ Encriptación end-to-end</p>
            <p>✓ Backups automáticos</p>
            <p>✓ Autenticación de dos factores</p>
            <p className='text-xs mt-4'>
              Tus datos están protegidos en servidores certificados.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Calendar className='h-5 w-5' />
              Facturación
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-[var(--text-secondary)]'>
            <p>
              <strong>Ciclo de facturación:</strong> Mensual (renovación automática)
            </p>
            <p>
              <strong>Cancelación:</strong> Válida hasta fin de período
            </p>
            <p className='text-xs mt-4'>
              Recibe recibos por email. Puedes cambiar o cancelar en cualquier
              momento.
            </p>
          </CardContent>
        </Card>
      </div>
    </div >
  );
};
