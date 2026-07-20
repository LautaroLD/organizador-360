'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, CheckCircle2, Loader2, Star, Zap } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import type { PlanLimits } from '@/lib/subscriptionUtils';
import {
  buildDisplayFeatures,
  mergePlanLimits,
} from '@/lib/subscriptionUtils';
import type { PlanTier } from '@/types/planTypes';

type Provider = 'lemon_squeezy' | 'local';

type LemonVariantResponse = {
  name: string;
  price?: string;
  buy_url?: string;
  hasFreeTrial: boolean;
  trialDays: number;
};

export type PlanVariantOption = {
  external_id: string;
  checkout_url?: string | null;
  interval?: string | null;
  is_default?: boolean;
  label?: string;
  limits?: PlanLimits;
  limits_override?: Record<string, unknown> | null;
  feature_catalog?: string[];
};

type PlanCardProps = {
  planCode: PlanTier;
  name?: string;
  description?: string | null;
  features?: string[];
  limits?: PlanLimits;
  /** Single variant shortcut; ignored when `variants` has items. */
  external_id?: string;
  checkout_url?: string | null;
  variants?: PlanVariantOption[];
  provider?: Provider;
  /** True when the user's tier matches this card (e.g. any Pro variant). */
  isCurrent: boolean;
  /** Lemon variant_id of the user's active subscription, if any. */
  currentVariantId?: string | null;
  isCanceled: boolean;
  payerEmail?: string;
  payerId?: string;
  hidePaidActions?: boolean;
};

const PLAN_ICONS: Record<PlanTier, React.ReactNode> = {
  free: <Zap className='h-8 w-8' />,
  starter: <Star className='h-8 w-8' />,
  pro: (
    <>
      <Star className='h-8 w-8' />
      <Star className='h-8 w-8' />
    </>
  ),
};

const DEFAULT_DESCRIPTIONS: Record<PlanTier, string> = {
  free: 'Perfecto para comenzar',
  starter: 'Para usuarios intermedios',
  pro: 'Para usuarios avanzados',
};

function variantLabel(
  option: PlanVariantOption,
  index: number,
  lemonName?: string | null,
): string {
  if (lemonName?.trim()) return lemonName.trim();
  if (option.label?.trim()) return option.label.trim();
  if (option.is_default) return 'Estándar';
  return `Opción ${index + 1}`;
}

function pickDefaultVariantId(options: PlanVariantOption[]): string {
  const preferred = options.find((item) => item.is_default) ?? options[0];
  return preferred?.external_id ?? '';
}

function pickInitialVariantId(
  options: PlanVariantOption[],
  currentVariantId?: string | null,
): string {
  if (
    currentVariantId &&
    options.some((item) => item.external_id === currentVariantId)
  ) {
    return currentVariantId;
  }
  return pickDefaultVariantId(options);
}

export default function PlanCard({
  planCode,
  name,
  description,
  features = [],
  limits,
  external_id,
  checkout_url,
  variants = [],
  provider = 'local',
  isCurrent,
  currentVariantId = null,
  isCanceled,
  payerEmail,
  payerId,
  hidePaidActions = false,
}: PlanCardProps) {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState<
    'form' | 'processing' | 'success'
  >('form');

  const variantOptions = useMemo(() => {
    if (variants.length > 0) return variants;
    if (external_id) {
      return [
        {
          external_id,
          checkout_url,
          is_default: true,
          interval: 'month',
        } satisfies PlanVariantOption,
      ];
    }
    return [] as PlanVariantOption[];
  }, [variants, external_id, checkout_url]);

  const [userSelectedVariantId, setUserSelectedVariantId] = useState<
    string | null
  >(null);

  const selectedVariantId = useMemo(() => {
    if (
      userSelectedVariantId &&
      variantOptions.some((item) => item.external_id === userSelectedVariantId)
    ) {
      return userSelectedVariantId;
    }
    return pickInitialVariantId(variantOptions, currentVariantId);
  }, [userSelectedVariantId, variantOptions, currentVariantId]);

  const selectedVariant =
    variantOptions.find((item) => item.external_id === selectedVariantId) ??
    variantOptions[0];

  const effectiveLimits = useMemo(() => {
    if (selectedVariant?.limits) return selectedVariant.limits;
    if (limits) {
      return mergePlanLimits(limits, selectedVariant?.limits_override);
    }
    return limits;
  }, [limits, selectedVariant]);

  const displayFeatures = useMemo(() => {
    const catalog =
      selectedVariant?.feature_catalog ??
      features;
    if (effectiveLimits) {
      return buildDisplayFeatures(effectiveLimits, catalog);
    }
    return catalog;
  }, [effectiveLimits, selectedVariant, features]);

  const shouldFetchLemon = Boolean(
    selectedVariant?.external_id && provider === 'lemon_squeezy',
  );

  const { data: lemon, isLoading, error } = useQuery<LemonVariantResponse>({
    queryKey: ['lemon-variant', selectedVariant?.external_id ?? 'local'],
    queryFn: async () => {
      const res = await fetch(
        `/api/lemon-squeezy/variant/${selectedVariant!.external_id}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        throw new Error('Error fetching plan data');
      }
      return res.json();
    },
    enabled: shouldFetchLemon,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const { data: variantNames } = useQuery({
    queryKey: [
      'lemon-variant-names',
      variantOptions.map((item) => item.external_id).join(','),
    ],
    queryFn: async () => {
      const entries = await Promise.all(
        variantOptions.map(async (option) => {
          try {
            const res = await fetch(
              `/api/lemon-squeezy/variant/${option.external_id}`,
              { credentials: 'include' },
            );
            if (!res.ok) return [option.external_id, null] as const;
            const data = (await res.json()) as LemonVariantResponse;
            return [option.external_id, data.name ?? null] as const;
          } catch {
            return [option.external_id, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
    enabled: provider === 'lemon_squeezy' && variantOptions.length > 1,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const isLoadingState = shouldFetchLemon && isLoading;
  const hasPlanDataError = shouldFetchLemon && !isLoadingState && !!error;
  const canRenderLocalFree = !shouldFetchLemon && planCode === 'free';
  const canRenderPlan =
    (!isLoadingState && !hasPlanDataError && (lemon || !shouldFetchLemon)) ||
    canRenderLocalFree;

  const isFree = planCode === 'free';
  const isPro = planCode === 'pro';
  const showVariantPicker = !isFree && variantOptions.length > 1;
  const displayPlanName = name ?? planCode.toUpperCase();
  const displayDescription = description ?? DEFAULT_DESCRIPTIONS[planCode];
  const displayPriceText = isFree
    ? 'Gratis'
    : lemon?.price || '$0/mes';
  const effectiveCheckoutUrl =
    selectedVariant?.checkout_url || lemon?.buy_url || checkout_url;
  const isCheckoutProcessing = checkoutState === 'processing';
  const isSelectedVariantCurrent = Boolean(
    currentVariantId &&
      selectedVariant?.external_id &&
      selectedVariant.external_id === currentVariantId,
  );
  const isCheckoutCurrent = currentVariantId
    ? isSelectedVariantCurrent
    : isCurrent;

  const isActionDisabled =
    isLoadingState || isCheckoutProcessing || isFree || isCheckoutCurrent;

  const handlePlanAction = async () => {
    setCheckoutState('form');
    setIsCheckoutOpen(true);
  };

  const renderCheckout = () => {
    if (provider !== 'lemon_squeezy') return null;

    return (
      <div className='rounded-lg border border-[var(--text-secondary)]/20 p-4'>
        <p className='mb-3 text-sm text-[var(--text-secondary)]'>
          Seras redirigido a Lemon Squeezy para completar el pago.
        </p>
        {selectedVariant && (
          <p className='mb-3 text-xs text-[var(--text-secondary)]'>
            Variante:{' '}
            <span className='font-medium text-[var(--text-primary)]'>
              {variantLabel(
                selectedVariant,
                variantOptions.findIndex(
                  (item) => item.external_id === selectedVariant.external_id,
                ),
                lemon?.name,
              )}
            </span>
            {displayPriceText ? ` · ${displayPriceText}` : null}
          </p>
        )}
        <Button
          className='w-full'
          type='button'
          onClick={() => {
            if (effectiveCheckoutUrl) {
              const params = new URLSearchParams({
                'checkout[email]': payerEmail as string,
                'checkout[custom][user_id]': payerId as string,
              });
              window.location.href = `${effectiveCheckoutUrl}?${params.toString()}`;
            }
          }}
          disabled={isCheckoutProcessing || !effectiveCheckoutUrl}
        >
          Continuar con Lemon Squeezy
        </Button>
      </div>
    );
  };

  return (
    <div className='relative h-full md:min-w-md md:max-w-md'>
      {isLoadingState && (
        <div className='flex min-h-80 items-center justify-center rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-6'>
          <div className='text-center'>
            <div className='mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-b-2 border-[var(--accent-primary)]' />
            <p className='text-sm text-[var(--text-secondary)]'>
              Cargando plan...
            </p>
          </div>
        </div>
      )}

      {hasPlanDataError && (
        <div className='flex min-h-80 items-center justify-center rounded-xl border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-6'>
          <div className='text-center'>
            <p className='mb-2 font-bold text-[var(--accent-danger)]'>
              No se pudo cargar el plan
            </p>
            <p className='text-xs text-[var(--text-secondary)]'>
              Intenta recargar la pagina o contacta soporte.
            </p>
          </div>
        </div>
      )}

      {canRenderPlan && (
        <div
          className={`relative flex h-full flex-col rounded-xl border p-6 transition-all ${
            isPro
              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-lg'
              : 'border-[var(--text-secondary)]/20 bg-[var(--bg-primary)]'
          }`}
        >
          {isPro && (
            <span className='absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--accent-primary)] px-3 py-1 text-xs font-bold text-[var(--accent-primary-contrast)]'>
              Mas popular
            </span>
          )}

          {isCurrent && !showVariantPicker && (
            <div
              className={`absolute right-3 top-3 rounded-full px-2 py-1 text-xs font-bold ${
                isCanceled
                  ? 'bg-[var(--accent-danger)]/20 text-[var(--accent-danger)]'
                  : 'bg-green-500/20 text-green-700'
              }`}
            >
              {isCanceled ? 'Cancelado' : 'Plan actual'}
            </div>
          )}

          <div
            className={`mb-3 flex items-start gap-3 ${
              showVariantPicker ? 'justify-between' : 'flex-col items-center'
            }`}
          >
            <div
              className={`flex min-w-0 flex-col gap-2 ${
                showVariantPicker ? 'items-start' : 'items-center'
              }`}
            >
              <span className='flex text-[var(--accent-primary)]'>
                {PLAN_ICONS[planCode]}
              </span>
              <h3 className='text-lg font-bold uppercase text-[var(--text-primary)]'>
                {displayPlanName}
              </h3>
            </div>

            {showVariantPicker && (
              <div className='flex min-w-0 shrink-0 flex-col items-end gap-2'>
                {isCurrent && (
                  <div
                    className={`rounded-full px-2 py-1 text-xs font-bold ${
                      isCanceled
                        ? 'bg-[var(--accent-danger)]/20 text-[var(--accent-danger)]'
                        : 'bg-green-500/20 text-green-700'
                    }`}
                  >
                    {isCanceled ? 'Cancelado' : 'Plan actual'}
                  </div>
                )}
                <fieldset className='space-y-1'>
                  <legend className='sr-only'>Variante</legend>
                  {variantOptions.map((option, index) => {
                    const inputId = `${planCode}-variant-${option.external_id}`;
                    const checked = option.external_id === selectedVariantId;
                    const optionName =
                      (checked ? lemon?.name : null) ||
                      variantNames?.[option.external_id];

                    return (
                      <label
                        key={option.external_id}
                        htmlFor={inputId}
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors ${
                          checked
                            ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                        }`}
                      >
                        <input
                          id={inputId}
                          type='radio'
                          name={`${planCode}-variant`}
                          className='h-4 w-4 accent-[var(--accent-primary)]'
                          checked={checked}
                          onChange={() =>
                            setUserSelectedVariantId(option.external_id)
                          }
                        />
                        <span className='whitespace-nowrap font-medium text-[var(--text-primary)]'>
                          {variantLabel(option, index, optionName)}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              </div>
            )}
          </div>

          <p className='mb-1 text-3xl font-extrabold text-[var(--text-primary)]'>
            {displayPriceText}
          </p>

          <p className='mb-1 text-sm text-[var(--text-secondary)]'>
            {displayDescription}
          </p>

          {lemon?.hasFreeTrial && lemon?.trialDays > 0 && (
            <p className='mt-1 text-xs font-medium text-[var(--accent-primary)]'>
              Incluye {lemon.trialDays} días de prueba gratis
            </p>
          )}

          <ul className='mb-6 mt-3 space-y-2'>
            {displayFeatures.map((feature, index) => (
              <li
                key={`${index}-${feature}`}
                className='flex items-start gap-2 text-sm text-[var(--text-secondary)]'
              >
                <Check className='mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]' />
                {feature}
              </li>
            ))}
          </ul>
          {!isFree && !hidePaidActions && (
            <Button
              className='mt-auto w-full'
              variant={isCheckoutCurrent ? 'primary' : 'secondary'}
              disabled={isActionDisabled}
              onClick={() => void handlePlanAction()}
            >
              {isCheckoutCurrent ? 'Plan actual' : 'Actualizar plan'}
            </Button>
          )}
          {!isFree && isCheckoutOpen && (
            <Modal
              isOpen={isCheckoutOpen}
              onClose={() => !isCheckoutProcessing && setIsCheckoutOpen(false)}
              title={`Checkout ${displayPlanName}`}
              size='lg'
            >
              {checkoutState === 'success' ? (
                <div className='p-6 text-center'>
                  <CheckCircle2 className='mx-auto h-12 w-12 text-emerald-500' />
                  <h4 className='font-bold'>Pago confirmado</h4>
                </div>
              ) : (
                <div className='relative'>
                  {renderCheckout()}
                  {isCheckoutProcessing && (
                    <div className='absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]/85'>
                      <Loader2 className='mx-auto h-8 w-8 animate-spin text-[var(--accent-primary)]' />
                    </div>
                  )}
                </div>
              )}
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}
