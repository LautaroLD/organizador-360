'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, HardDrive, Lock, Star, Users } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { buttonVariants } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import PlanCard from '@/components/ui/PlanCard';
import { formatBytes, type PlanLimits } from '@/lib/subscriptionUtils';
import type { PlanTier } from '@/types/planTypes';

interface CatalogPlan {
  provider: 'lemon_squeezy' | 'local';
  plan_code: PlanTier;
  name: string;
  description: string | null;
  features: string[];
  feature_catalog?: string[];
  limits: PlanLimits;
  limits_override?: Record<string, unknown>;
  sort_order: number;
  external_id?: string;
  checkout_url?: string | null;
  is_default?: boolean;
  interval?: string | null;
}

interface PlansByProvidersResponse {
  free?: CatalogPlan;
  lemon_squeezy?: CatalogPlan[];
  all_lemon_squeezy?: CatalogPlan[];
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
  variantId?: string | null;
  variantName?: string | null;
  paymentMethod?: string | null;
  customerPortalUrl?: string | null;
  updatePaymentMethodUrl?: string | null;
  updateSubscriptionUrl?: string | null;
}

interface SubscriptionDetailsResponse {
  hasSubscription?: boolean;
  source?: 'lemon_squeezy' | 'database' | null;
  planContext?: PlanContextResponse;
  currentVariantId?: string | null;
  details?: LemonSqueezyDetails | null;
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
  // Lemon Squeezy entrega ISO 8601 con zona; calculamos por fecha UTC para evitar desfases de día.
  if (isIsoDateTimeWithTimeZone(dateValue)) {
    const startOfTodayUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const startOfEndUtc = Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
    );
    const diffDays = Math.floor(
      (startOfEndUtc - startOfTodayUtc) / (1000 * 60 * 60 * 24),
    );
    return diffDays > 0 ? diffDays : null;
  }

  if (end <= now) return null;
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isIsoDateTimeWithTimeZone(value: string): boolean {
  return /T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}
function formatSubscriptionDate(dateValue?: string | null): string {
  if (!dateValue) return 'N/A';
  return formatDate(dateValue, { preserveUTCDate: true });
}

export const SubscriptionView: React.FC = () => {
  const { user } = useAuthStore();

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

  const { data: lemonData, isLoading: lemonDataLoading } = useQuery({
    queryKey: ['lemon-subscription-details', user?.id],
    queryFn: async (): Promise<SubscriptionDetailsResponse | null> => {
      const response = await fetch('/api/lemon-squeezy/subscription-details');
      if (!response.ok) return null;
      return (await response.json()) as SubscriptionDetailsResponse;
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

  const freePlan = plansGroupByProviders?.free;
  const allLemonPlans =
    plansGroupByProviders?.all_lemon_squeezy ??
    plansGroupByProviders?.lemon_squeezy ??
    [];

  const lsPlans = (() => {
    const byCode = new Map<
      PlanTier,
      {
        plan: CatalogPlan;
        variants: NonNullable<CatalogPlan[]>;
      }
    >();

    for (const plan of allLemonPlans) {
      if (plan.plan_code !== 'starter' && plan.plan_code !== 'pro') continue;
      const existing = byCode.get(plan.plan_code);
      if (!existing) {
        byCode.set(plan.plan_code, { plan, variants: [plan] });
        continue;
      }
      existing.variants.push(plan);
      if (plan.is_default) {
        existing.plan = plan;
      }
    }

    return [...byCode.values()].sort(
      (a, b) => a.plan.sort_order - b.plan.sort_order,
    );
  })();

  const planLimitsByCode = new Map<PlanTier, PlanLimits>();
  if (freePlan) {
    planLimitsByCode.set('free', freePlan.limits);
  }
  for (const { plan } of lsPlans) {
    planLimitsByCode.set(plan.plan_code, plan.limits);
  }
  const lemonDetails = lemonData?.details;
  const planContext = lemonData?.planContext ?? {
    plan_tier: 'free',
    source: 'free',
    expires_at: null,
  };
  const contextTier = normalizeTier(planContext?.plan_tier);
  const currentPlanTier: PlanTier = contextTier;
  const currentVariantId =
    lemonData?.currentVariantId ?? lemonDetails?.variantId ?? null;
  const isManualAccess = planContext?.source === 'manual';
  const periodEndDate = lemonDetails?.currentPeriodEnd ?? null;
  const hasFuturePeriodEnd = Boolean(
    periodEndDate && new Date(periodEndDate) > new Date(),
  );
  const isPaid = currentPlanTier !== 'free';

  const isCanceled = Boolean(
    isPaid &&
    !isManualAccess &&
    hasFuturePeriodEnd &&
    (
      lemonDetails?.cancelAtPeriodEnd ||
      lemonDetails?.status?.toLowerCase() === 'canceled' ||
      lemonDetails?.status?.toLowerCase() === 'cancelled'
    )
  );

  const lemonTrialDaysRemaining = calculateDaysRemaining(lemonDetails?.trialEndsAt);
  const subscriptionDaysRemaining = calculateDaysRemaining(periodEndDate);

  if (plansGroupByProvidersLoading || lemonDataLoading) {
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

      { isPaid && (
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
                          Vence el { formatSubscriptionDate(planContext.expires_at) }
                        </span>
                      ) }
                    </span>
                  ) : (
                    <span className='inline-flex items-center gap-2 text-[var(--text-secondary)]'>
                      { lemonDetails?.statusLabel ?? 'Activa' }
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
                    ? (planContext?.expires_at ? formatSubscriptionDate(planContext.expires_at) : 'Sin vencimiento')
                    : (lemonDetails?.currentPeriodEnd
                      ? formatSubscriptionDate(lemonDetails.currentPeriodEnd)
                      : 'N/A') }
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className='flex flex-col gap-4'>
              { !isManualAccess && (
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
                        : currentPlanTier }
                    </span>
                  </div>
                  { lemonDetails?.id && (
                    <div>
                      <span className='text-[var(--text-secondary)] block'>ID suscripción</span>
                      <span className='font-medium text-[var(--text-primary)] font-mono text-xs'>
                        { lemonDetails.id }
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
                { lemonDetails?.currentPeriodStart && lemonDetails?.currentPeriodEnd && (
                  <div>
                    <span className='text-[var(--text-secondary)]'>
                      Período actual: { formatSubscriptionDate(lemonDetails.currentPeriodStart) } a{ ' ' }
                      { formatSubscriptionDate(lemonDetails.currentPeriodEnd) }
                    </span>
                  </div>
                ) }

                { !isManualAccess && lemonDetails?.cancelAtPeriodEnd && (
                  <div className='px-3 py-1 bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/30 rounded text-[var(--accent-danger)] text-xs font-medium'>
                    Cancelada al final del período
                  </div>
                ) }
              </div>

              { !isManualAccess && (
                <div className='flex flex-wrap items-center gap-2 border-t border-[var(--border-primary)] pt-4'>
                  { lemonDetails?.updateSubscriptionUrl && (
                    <a
                      className={ cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'no-underline') }
                      href={ lemonDetails.updateSubscriptionUrl }
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      Cambiar plan en Lemon
                    </a>
                  ) }

                  { lemonDetails?.updatePaymentMethodUrl && (
                    <a
                      className={ cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'no-underline') }
                      href={ lemonDetails.updatePaymentMethodUrl }
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      Actualizar método de pago
                    </a>
                  ) }

                  { lemonDetails?.customerPortalUrl && (
                    <a
                      className={ cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline') }
                      href={ lemonDetails.customerPortalUrl }
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      Abrir portal de facturación
                    </a>
                  ) }
                </div>
              ) }
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
                  <span>Renovación: { aiCredits.cycle_end ? formatSubscriptionDate(aiCredits.cycle_end) : 'N/A' }</span>
                  <span>Inicio ciclo: { aiCredits.cycle_start ? formatSubscriptionDate(aiCredits.cycle_start) : 'N/A' }</span>
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
            planCode='free'
            name={ freePlan?.name ?? 'Free' }
            description={ freePlan?.description }
            features={ freePlan?.features ?? [] }
            limits={ freePlan?.limits }
            provider='local'
            isCurrent={ currentPlanTier === 'free' }
            isCanceled={ false }
            payerEmail={ user?.email }
            hidePaidActions={ Boolean(isPaid && !isManualAccess) }
          />

          { lsPlans.map(({ plan, variants }) => (
            <PlanCard
              key={ `ls_${plan.plan_code}` }
              planCode={ plan.plan_code }
              name={ plan.name }
              description={ plan.description }
              features={ plan.features }
              limits={ plan.limits }
              external_id={ plan.external_id }
              checkout_url={ plan.checkout_url }
              variants={ variants
                .filter((item) => Boolean(item.external_id))
                .map((item) => ({
                  external_id: item.external_id as string,
                  checkout_url: item.checkout_url,
                  interval: item.interval,
                  is_default: item.is_default,
                  limits: item.limits,
                  limits_override: item.limits_override,
                  feature_catalog: item.feature_catalog ?? item.features,
                })) }
              provider='lemon_squeezy'
              isCurrent={ currentPlanTier === plan.plan_code }
              currentVariantId={ currentVariantId }
              isCanceled={ isCanceled }
              payerEmail={ user?.email }
              payerId={ user?.id }
              hidePaidActions={ Boolean(isPaid && !isManualAccess) }
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
            { (['free', 'starter', 'pro'] as PlanTier[]).map((code) => {
              const limits = planLimitsByCode.get(code);
              if (!limits) return null;
              const label =
                code === 'free' ? 'Gratuito' : code === 'starter' ? 'Starter' : 'Pro';
              return (
                <p key={ `storage_${code}` }>
                  <strong>{ label }:</strong>{ ' ' }
                  Hasta { formatBytes(limits.max_storage_bytes, 0) } por proyecto
                </p>
              );
            }) }
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
            { (['free', 'starter', 'pro'] as PlanTier[]).map((code) => {
              const limits = planLimitsByCode.get(code);
              if (!limits) return null;
              const label =
                code === 'free' ? 'Gratuito' : code === 'starter' ? 'Starter' : 'Pro';
              return (
                <p key={ `members_${code}` }>
                  <strong>{ label }:</strong>{ ' ' }
                  Hasta { limits.max_members_per_project } miembros por proyecto
                </p>
              );
            }) }
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
              Recibe recibos por email. Gestiona cambios de plan y cancelación desde el portal de Lemon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
