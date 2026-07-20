import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  FALLBACK_PLAN_LIMITS,
  buildDisplayFeatures,
  mergePlanLimits,
  parsePlanLimits,
  type PlanLimits,
} from '@/lib/subscriptionUtils';
import type { PlanTier } from '@/types/planTypes';

export type CatalogPlan = {
  provider: 'lemon_squeezy' | 'local';
  plan_code: PlanTier;
  name: string;
  description: string | null;
  /** Catalog features with quota lines already resolved for this variant. */
  features: string[];
  /** Raw catalog features (for client-side recompute on variant switch). */
  feature_catalog: string[];
  limits: PlanLimits;
  limits_override?: Record<string, unknown>;
  sort_order: number;
  external_id?: string;
  checkout_url?: string | null;
  is_default?: boolean;
  interval?: string | null;
};

function parseFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * GET /api/plans
 *
 * Catálogo interno: limits/features desde `plans`, variants Lemon desde mappings.
 * Cada mapping puede traer `limits_override` (p.ej. más storage en Pro +).
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: allPlans, error: plansError } = await supabase
      .from('plans')
      .select(
        'id, code, name, description, limits, features, sort_order, is_active',
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (plansError) {
      console.error('Error fetching plans:', plansError);
      return NextResponse.json(
        { error: 'Error obteniendo planes' },
        { status: 500 },
      );
    }

    const { data: mappings, error: mappingsError } = await supabase
      .from('plan_provider_mappings')
      .select(
        'provider, external_id, checkout_url, interval, is_default, plan_id, limits_override',
      )
      .eq('provider', 'lemon_squeezy');

    if (mappingsError) {
      console.error('Error fetching plan mappings:', mappingsError);
      return NextResponse.json(
        { error: 'Error obteniendo planes' },
        { status: 500 },
      );
    }

    const plansById = new Map((allPlans ?? []).map((plan) => [plan.id, plan]));

    const freePlan = (allPlans ?? []).find(
      (plan) => plan.code?.toLowerCase() === 'free',
    );

    const freeLimits = freePlan
      ? parsePlanLimits(freePlan.limits)
      : FALLBACK_PLAN_LIMITS.free;
    const freeCatalogFeatures = freePlan
      ? parseFeatures(freePlan.features)
      : [
          'Hasta 3 proyectos',
          'Canales y chat ilimitados',
          'Hasta 100 MB de recursos',
          'Hasta 10 miembros por proyecto',
          'Soporte por email',
        ];

    const freeCatalog: CatalogPlan = {
      provider: 'local',
      plan_code: 'free',
      name: freePlan?.name ?? 'Free',
      description:
        freePlan?.description ?? 'Perfecto para comenzar',
      feature_catalog: freeCatalogFeatures,
      features: buildDisplayFeatures(freeLimits, freeCatalogFeatures),
      limits: freeLimits,
      sort_order: freePlan?.sort_order ?? 0,
    };

    const lemonPlans: CatalogPlan[] = (mappings ?? [])
      .map((mapping): CatalogPlan | null => {
        const plan = plansById.get(mapping.plan_id);
        if (!plan) return null;

        const code = plan.code?.toLowerCase();
        if (code !== 'starter' && code !== 'pro') return null;

        const baseLimits = parsePlanLimits(plan.limits);
        const override =
          mapping.limits_override &&
          typeof mapping.limits_override === 'object' &&
          !Array.isArray(mapping.limits_override)
            ? (mapping.limits_override as Record<string, unknown>)
            : {};
        const limits = mergePlanLimits(baseLimits, override);
        const featureCatalog = parseFeatures(plan.features);

        return {
          provider: 'lemon_squeezy',
          plan_code: code,
          name: plan.name,
          description: plan.description,
          feature_catalog: featureCatalog,
          features: buildDisplayFeatures(limits, featureCatalog),
          limits,
          limits_override: override,
          sort_order: plan.sort_order,
          external_id: mapping.external_id,
          checkout_url: mapping.checkout_url,
          is_default: Boolean(mapping.is_default),
          interval: mapping.interval,
        };
      })
      .filter((item): item is CatalogPlan => item !== null)
      .sort((a, b) => a.sort_order - b.sort_order);

    const preferredLemon: CatalogPlan[] = [];
    const seenCodes = new Set<string>();
    for (const plan of lemonPlans) {
      if (seenCodes.has(plan.plan_code)) continue;
      const defaults = lemonPlans.filter(
        (p) => p.plan_code === plan.plan_code && p.is_default,
      );
      preferredLemon.push(defaults[0] ?? plan);
      seenCodes.add(plan.plan_code);
    }

    return NextResponse.json(
      {
        free: freeCatalog,
        lemon_squeezy: preferredLemon,
        all_lemon_squeezy: lemonPlans,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
