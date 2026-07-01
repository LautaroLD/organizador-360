'use client';

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, HardDrive, Lock, Star, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import { createClient } from '@/lib/supabase/client';
import { hasPaidAccess } from '@/lib/subscriptionUtils';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import PlanCard from '@/components/ui/PlanCard';
import type { PlanTier } from '@/types/planTypes';

interface ProviderPlan {
  provider: 'lemon_squeezy';
  external_id: string;
  plan_code?: 'starter' | 'pro';
}

interface PlansByProvidersResponse {
  lemon_squeezy?: ProviderPlan[];
  [key: string]: ProviderPlan[] | undefined;
}

interface SubscriptionRow {
  status: string | null;
  plan_tier: string | null;
  cancel_at_period_end: boolean | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  payment_provider: string | null;
  lemon_squeezy_subscription_id: string | null;
}

interface PlanContextResponse {
  plan_tier?: PlanTier;
  source?: 'manual' | 'subscription' | 'free';
  expires_at?: string | null;
}

interface AICreditStatusResponse {
  can_use_ai: boolean;
  plan_tier: string;
  quota: number;
  used: number;
  remaining: number;
  cycle_start: string | null;
  cycle_end: string | null;
}

interface LemonSqueezyDetails {
  id: string;
  status: string;
  statusLabel: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  variantName?: string | null;
  paymentMethod?: string | null;
}

function normalizeTier(value?: string | null): PlanTier {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'starter' || normalized === 'pro') {
    return normalized;
  }
  return 'free';
}

function calculateDaysRemaining(dateValue?: string | null): number | null {
  if (!dateValue) return null;
  const end = new Date(dateValue);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  if (end <= now) return null;
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export const SubscriptionView: React.FC = () => {
  const supabase = createClient();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: planContext, isLoading: planContextLoading } = useQuery({
    queryKey: ['plan-context', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return {
          plan_tier: 'free',
          source: 'free',
          expires_at: null,
        } satisfies PlanContextResponse;
      }

      const { data } = await supabase.rpc('get_user_plan_context', {
        p_user_id: user.id,
      });

      return (data ?? {
        plan_tier: 'free',
        source: 'free',
        expires_at: null,
      }) as PlanContextResponse;
    },
    enabled: !!user?.id,
  });

  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select(
          'status, plan_tier, cancel_at_period_end, current_period_start, current_period_end, canceled_at, payment_provider, lemon_squeezy_subscription_id'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message || 'Error obteniendo suscripción');
      }

      return (data ?? null) as SubscriptionRow | null;
    },
    enabled: !!user?.id,
  });

  const { data: plansGroupByProviders, isLoading: plansGroupByProvidersLoading } = useQuery<PlansByProvidersResponse>({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await fetch('/api/plans');
      if (!res.ok) throw new Error('Error cargando configuración de planes');
      return (await res.json()) as PlansByProvidersResponse;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: lemonData } = useQuery({
    queryKey: ['lemon-subscription-details', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/lemon-squeezy/subscription-details');
      if (!response.ok) return null;
      const data = await response.json();
      return {
        details: (data.details ?? null) as LemonSqueezyDetails | null,
        source: (data.source ?? null) as string | null,
      };
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { data: aiCredits, isLoading: aiCreditsLoading } = useQuery({
    queryKey: ['ai-credits', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/ia/credits', {
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as AICreditStatusResponse;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const orderByTier = (plans: ProviderPlan[]) => {
    const rank: Record<'starter' | 'pro', number> = { starter: 0, pro: 1 };
    return [...plans].sort((a, b) => {
      const aRank = a.plan_code ? rank[a.plan_code] : Number.MAX_SAFE_INTEGER;
      const bRank = b.plan_code ? rank[b.plan_code] : Number.MAX_SAFE_INTEGER;
      return aRank - bRank;
    });
  };

  const lsPlans = orderByTier(plansGroupByProviders?.lemon_squeezy ?? []);
  const lemonDetails = lemonData?.details;
  const contextTier = normalizeTier(planContext?.plan_tier);
  const subscriptionTier = normalizeTier(subscription?.plan_tier);
  const currentPlanTier: PlanTier = contextTier !== 'free' ? contextTier : subscriptionTier;
  const isManualAccess = planContext?.source === 'manual';

  const paidAccessFromSubscription = hasPaidAccess(
    {
      status: subscription?.status,
      cancel_at_period_end: subscription?.cancel_at_period_end,
      current_period_end: subscription?.current_period_end,
    },
    undefined,
  );

  const hasFuturePeriodEnd = Boolean(
    subscription?.current_period_end &&
    new Date(subscription.current_period_end) > new Date()
  );

  const isPaid = currentPlanTier !== 'free' && (isManualAccess || paidAccessFromSubscription);

  const isCanceled = Boolean(
    isPaid &&
    !isManualAccess &&
    hasFuturePeriodEnd &&
    (
      subscription?.cancel_at_period_end ||
      lemonDetails?.cancelAtPeriodEnd ||
      subscription?.status === 'canceled' ||
      subscription?.status === 'cancelled'
    )
  );

  const lemonTrialDaysRemaining = calculateDaysRemaining(lemonDetails?.trialEndsAt);
  const subscriptionDaysRemaining = calculateDaysRemaining(
    lemonDetails?.currentPeriodEnd ?? subscription?.current_period_end
  );

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/lemon-squeezy/cancel-subscription', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Error al cancelar suscripción');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Suscripción cancelada. Tu plan finalizará al fin del período.');
      queryClient.invalidateQueries({ queryKey: ['subscription'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['lemon-subscription-details'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['plan-context'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['ai-credits'], exact: false });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Error al cancelar';
      toast.error(message);
    },
  });

  if (subscriptionLoading || planContextLoading || plansGroupByProvidersLoading) {
    return (
      <div className='flex items-center justify-center h-full p-12'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4' />
          <p className='text-[var(--text-secondary)]'>Cargando datos de suscripción...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='p-6 mx-auto'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-[var(--text-primary)] mb-2'>Planes y Suscripción</h1>
        <p className='text-[var(--text-secondary)]'>
          Elige el plan que mejor se adapte a tus necesidades. Pagos procesados por Lemon Squeezy.
        </p>
      </div>

      { isPaid && (subscription || isManualAccess) && (
        <Card className='mb-8 border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5'>
          <CardHeader>
            <div className='flex items-center justify-between gap-4'>
              <div className='space-y-2'>
                <CardTitle className='flex items-center gap-2'>
                  <Star className='h-5 w-5 text-[var(--accent-primary)]' />
                  { isManualAccess
                    ? `Plan ${currentPlanTier.toUpperCase()} (Manual)`
                    : `Plan ${currentPlanTier.toUpperCase()}` }
                </CardTitle>

                <CardDescription>
                  { isManualAccess ? (
                    <span className='inline-flex items-center gap-2 text-[var(--text-secondary)]'>
                      Acceso manual activo
                      { planContext?.expires_at && (
                        <span className='text-xs bg-[var(--accent-warning)]/10 text-[var(--text-warning)] px-2 py-0.5 rounded'>
                          Vence el { formatDate(planContext.expires_at) }
                        </span>
                      ) }
                    </span>
                  ) : (
                    <span className='inline-flex items-center gap-2 text-[var(--text-secondary)]'>
                      { lemonDetails?.statusLabel ?? subscription?.status ?? 'Activa' }
                      <span className='text-xs bg-[var(--bg-secondary)] text-[var(--text-secondary)] px-2 py-0.5 rounded border border-[var(--border-primary)]'>
                        Lemon Squeezy
                      </span>
                      { isCanceled && subscriptionDaysRemaining !== null && subscriptionDaysRemaining > 0 && (
                        <span className='text-xs bg-[var(--accent-danger)]/10 text-[var(--accent-danger)] px-2 py-0.5 rounded border border-[var(--accent-danger)]/30'>
                          { subscriptionDaysRemaining === 1
                            ? 'Finaliza en 1 día'
                            : `Finaliza en ${subscriptionDaysRemaining} días` }
                        </span>
                      ) }
                      { lemonTrialDaysRemaining !== null && lemonTrialDaysRemaining > 0 && (
                        <span className='text-xs bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] px-2 py-0.5 rounded border border-[var(--accent-primary)]/30'>
                          { lemonTrialDaysRemaining === 1
                            ? 'Prueba gratis: último día'
                            : `Prueba gratis: ${lemonTrialDaysRemaining} días` }
                        </span>
                      ) }
                    </span>
                  ) }
                </CardDescription>
              </div>

              <div className='text-right'>
                <div className='text-sm text-[var(--text-secondary)]'>
                  { isManualAccess ? 'Validez:' : 'Renovación:' }
                </div>
                <div className='text-lg font-semibold text-[var(--text-primary)]'>
                  { isManualAccess
                    ? (planContext?.expires_at ? formatDate(planContext.expires_at) : 'Sin vencimiento')
                    : (lemonDetails?.currentPeriodEnd || subscription?.current_period_end
                      ? formatDate(lemonDetails?.currentPeriodEnd ?? subscription?.current_period_end ?? '')
                      : 'N/A') }
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className='flex flex-col gap-4'>
              { !isManualAccess && subscription && (
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                  <div>
                    <span className='text-[var(--text-secondary)] block'>Procesador de pago</span>
                    <span className='font-medium text-[var(--text-primary)]'>Lemon Squeezy</span>
                  </div>
                  <div>
                    <span className='text-[var(--text-secondary)] block'>Plan</span>
                    <span className='font-medium text-[var(--text-primary)] uppercase'>
                      { lemonDetails?.variantName && lemonDetails.variantName !== 'Default'
                        ? lemonDetails.variantName
                        : (subscription.plan_tier ?? currentPlanTier) }
                    </span>
                  </div>
                  { (lemonDetails?.id || subscription.lemon_squeezy_subscription_id) && (
                    <div>
                      <span className='text-[var(--text-secondary)] block'>ID suscripción</span>
                      <span className='font-medium text-[var(--text-primary)] font-mono text-xs'>
                        { lemonDetails?.id || subscription.lemon_squeezy_subscription_id }
                      </span>
                    </div>
                  ) }
                  { lemonDetails?.paymentMethod && (
                    <div>
                      <span className='text-[var(--text-secondary)] block'>Método de pago</span>
                      <span className='font-medium text-[var(--text-primary)]'>
                        { lemonDetails.paymentMethod }
                      </span>
                    </div>
                  ) }
                </div>
              ) }

              <div className='flex items-center gap-4 text-sm border-t border-[var(--border-primary)] pt-4'>
                { subscription?.current_period_start && subscription?.current_period_end && (
                  <div>
                    <span className='text-[var(--text-secondary)]'>
                      Período actual: { formatDate(subscription.current_period_start) } a{ ' ' }
                      { formatDate(subscription.current_period_end) }
                    </span>
                  </div>
                ) }

                { !isManualAccess && subscription && !subscription.cancel_at_period_end && (
                  <Button
                    variant='secondary'
                    size='sm'
                    onClick={ () => cancelMutation.mutate() }
                    disabled={ cancelMutation.isPending }
                  >
                    { cancelMutation.isPending ? 'Cancelando...' : 'Cancelar suscripción' }
                  </Button>
                ) }

                { !isManualAccess && subscription?.cancel_at_period_end && (
                  <div className='px-3 py-1 bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/30 rounded text-[var(--accent-danger)] text-xs font-medium'>
                    Cancelada al final del período
                  </div>
                ) }
              </div>
            </div>
          </CardContent>
        </Card>
      ) }

      { (currentPlanTier === 'pro') && (
        <Card className='mb-8 border-[var(--accent-primary)]/30'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Star className='h-5 w-5 text-[var(--accent-primary)]' />
              Créditos IA
            </CardTitle>
            <CardDescription>
              Tu cupo mensual se renueva con la renovación de tu suscripción. Los créditos no usados no se acumulan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            { aiCreditsLoading ? (
              <p className='text-sm text-[var(--text-secondary)]'>Cargando créditos IA...</p>
            ) : aiCredits?.can_use_ai ? (
              <div className='space-y-3'>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-sm'>
                  <div className='rounded-lg border border-[var(--border-primary)] p-3 bg-[var(--bg-secondary)]/40'>
                    <div className='text-[var(--text-secondary)]'>Disponibles</div>
                    <div className='text-2xl font-bold text-[var(--accent-primary)]'>
                      { aiCredits.remaining }
                    </div>
                  </div>
                  <div className='rounded-lg border border-[var(--border-primary)] p-3 bg-[var(--bg-secondary)]/40'>
                    <div className='text-[var(--text-secondary)]'>Usados</div>
                    <div className='text-2xl font-semibold text-[var(--text-primary)]'>
                      { aiCredits.used }
                    </div>
                  </div>
                  <div className='rounded-lg border border-[var(--border-primary)] p-3 bg-[var(--bg-secondary)]/40'>
                    <div className='text-[var(--text-secondary)]'>Cupo mensual</div>
                    <div className='text-2xl font-semibold text-[var(--text-primary)]'>
                      { aiCredits.quota }
                    </div>
                  </div>
                </div>

                <div className='w-full h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden'>
                  <div
                    className='h-full bg-[var(--accent-primary)] transition-all'
                    style={ {
                      width: `${Math.min(
                        100,
                        Math.max(0, aiCredits.quota > 0 ? (aiCredits.used / aiCredits.quota) * 100 : 0)
                      )}%`,
                    } }
                  />
                </div>

                <div className='flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--text-secondary)]'>
                  <span>Renovación: { aiCredits.cycle_end ? formatDate(aiCredits.cycle_end) : 'N/A' }</span>
                  <span>Inicio ciclo: { aiCredits.cycle_start ? formatDate(aiCredits.cycle_start) : 'N/A' }</span>
                </div>
              </div>
            ) : (
              <p className='text-sm text-[var(--text-secondary)]'>
                Los créditos IA estarán disponibles cuando tu plan Pro esté activo.
              </p>
            ) }
          </CardContent>
        </Card>
      ) }

      <div className='-mx-6 bg-[var(--bg-secondary)] px-6 py-10 mb-8'>
        <div className='flex gap-6 overflow-x-auto px-4 pb-2 pt-14 flex-col md:flex-row'>
          <PlanCard
            key='free_local_plan'
            forceTier='free'
            isCurrent={ currentPlanTier === 'free' }
            isCanceled={ false }
            payerEmail={ user?.email }
          />

          { lsPlans.map((plan) => (
            <PlanCard
              key={ `ls_${plan.external_id}` }
              external_id={ plan.external_id }
              provider={ plan.provider }
              isCurrent={ currentPlanTier === (plan.plan_code ?? 'free') }
              isCanceled={ isCanceled }
              payerEmail={ user?.email }
              payerId={ user?.id }
            />
          )) }
        </div>
      </div>

      <div className='grid md:grid-cols-2 gap-6 md:px-10 py-5'>
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
              <strong>Starter:</strong> Hasta 1 GB por proyecto
            </p>
            <p>
              <strong>Pro:</strong> Hasta 5 GB por proyecto
            </p>
            <p className='text-xs mt-4'>
              El almacenamiento se calcula a partir de tus recursos y archivos subidos.
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
              <strong>Starter:</strong> Hasta 15 miembros por proyecto
            </p>
            <p>
              <strong>Pro:</strong> Hasta 20 miembros por proyecto
            </p>
            <p className='text-xs mt-4'>
              Invita a tu equipo a colaborar en proyectos. Los permisos se asignan por rol.
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
              Recibe recibos por email. Puedes cambiar o cancelar en cualquier momento.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
