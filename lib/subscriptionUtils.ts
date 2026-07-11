import { PlanTier } from '@/types/planTypes';

import { SupabaseClient } from '@supabase/supabase-js';

// (Se eliminará esta línea)

export type SubscriptionProvider = 'lemon_squeezy';

type lemon_squeezyStatus = 'authorized' | 'pending' | 'paused' | 'cancelled';

type SubscriptionAccessSnapshot = {
  status?: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;
};

const KNOWN_PAID_TIERS: ReadonlyArray<PlanTier> = ['starter', 'pro'];

function normalizeTier(value?: string | null): PlanTier {
  const normalized = value?.toLowerCase();
  if (normalized === 'starter' || normalized === 'pro') {
    return normalized;
  }
  return 'free';
}

function buildPlanIdMap(
  useServerEnv: boolean,
): Record<'starter' | 'pro', string[]> {
  const env = process.env;
  const pick = (serverName: string, publicName: string) => {
    const serverValue = useServerEnv ? env[serverName] : undefined;
    return serverValue ?? env[publicName] ?? '';
  };

  return {
    starter: [
      pick('MP_STARTER_MENSUAL_PLAN_ID', 'NEXT_PUBLIC_LEMON_STARTER_PLAN_ID'),
    ].filter(Boolean),
    pro: [
      pick('MP_PRO_MENSUAL_PLAN_ID', 'NEXT_PUBLIC_LEMON_PRO_PLAN_ID'),
    ].filter(Boolean),
  };
}

function buildLemonVariantIdMap(): Record<'starter' | 'pro', string[]> {
  const env = process.env;

  return {
    starter: [env.NEXT_PUBLIC_LEMON_STARTER_VARIANT_ID ?? ''].filter(Boolean),
    pro: [env.NEXT_PUBLIC_LEMON_PRO_VARIANT_ID ?? ''].filter(Boolean),
  };
}

export function mapLemonVariantIdToTier(
  variantId?: string | number | null,
): PlanTier {
  if (variantId === null || variantId === undefined) return 'free';

  const normalizedVariantId = String(variantId).trim();
  if (!normalizedVariantId) return 'free';

  const map = buildLemonVariantIdMap();
  if (map.starter.includes(normalizedVariantId)) return 'starter';
  if (map.pro.includes(normalizedVariantId)) return 'pro';
  return 'free';
}

export function maplemon_squeezyPlanIdToTier(
  planId?: string | null,
  useServerEnv = false,
): PlanTier {
  if (!planId) return 'free';
  const map = buildPlanIdMap(useServerEnv);
  if (map.starter.includes(planId)) return 'starter';
  if (map.pro.includes(planId)) return 'pro';
  return 'free';
}

export function resolveEffectivePlanTier(input: {
  planTier?: string | null;
  internalPlanTier?: string | null;
}): PlanTier {
  const fromDb = normalizeTier(input.planTier);
  if (KNOWN_PAID_TIERS.includes(fromDb)) return fromDb;

  const fromInternal = normalizeTier(input.internalPlanTier);
  if (KNOWN_PAID_TIERS.includes(fromInternal)) return fromInternal;

  return 'free';
}

export function normalizelemon_squeezyStatus(
  status?: string | null,
): lemon_squeezyStatus | null {
  if (!status) return null;
  const normalized = status.toLowerCase();
  if (
    normalized === 'authorized' ||
    normalized === 'pending' ||
    normalized === 'paused' ||
    normalized === 'cancelled'
  ) {
    return normalized;
  }
  return null;
}

export function maplemon_squeezyStatusToDbStatus(
  status?: string | null,
): string {
  const normalized = normalizelemon_squeezyStatus(status);
  switch (normalized) {
    case 'authorized':
      return 'active';
    case 'pending':
      return 'incomplete';
    case 'paused':
      return 'past_due';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'active';
  }
}

export function mapLemonStatusToDbStatus(status?: string | null): string {
  if (!status) return 'incomplete';

  switch (status.toLowerCase()) {
    case 'active':
      return 'active';
    case 'on_trial':
      return 'trialing';
    case 'past_due':
    case 'paused':
      return 'past_due';
    case 'cancelled':
    case 'expired':
      return 'cancelled';
    case 'unpaid':
      return 'unpaid';
    default:
      return 'incomplete';
  }
}

export function hasPaidAccess(
  snapshot: SubscriptionAccessSnapshot | null | undefined,
  lemon_squeezyStatus?: string | null,
): boolean {
  if (!snapshot) return false;

  const now = new Date();
  const normalizedMpStatus = normalizelemon_squeezyStatus(lemon_squeezyStatus);

  if (normalizedMpStatus === 'authorized') {
    return true;
  }

  const periodEnd = snapshot.current_period_end
    ? new Date(snapshot.current_period_end)
    : null;
  const hasFuturePeriodEnd = Boolean(
    periodEnd && !Number.isNaN(periodEnd.getTime()) && periodEnd > now,
  );

  const status = snapshot.status?.toLowerCase();
  const dbStatusIsActive =
    status === 'active' ||
    status === 'authorized' ||
    status === 'trialing' ||
    status === 'past_due';

  if (dbStatusIsActive) {
    return true;
  }

  const canceled =
    normalizedMpStatus === 'cancelled' ||
    status === 'canceled' ||
    status === 'cancelled';

  if (canceled && snapshot.cancel_at_period_end && hasFuturePeriodEnd) {
    return true;
  }

  return false;
}

export const SUBSCRIPTION_LIMITS = {
  FREE: {
    MAX_PROJECTS: 3,
    MAX_MEMBERS_PER_PROJECT: 10,
    MAX_STORAGE_BYTES: 100 * 1024 * 1024, // 100 MB
    AI_FEATURES_ENABLED: false,
  },
  STARTER: {
    MAX_PROJECTS: 5,
    MAX_MEMBERS_PER_PROJECT: 15,
    MAX_STORAGE_BYTES: 1024 * 1024 * 1024, // 1 GB
    AI_FEATURES_ENABLED: false,
  },
  PRO: {
    MAX_PROJECTS: 10,
    MAX_MEMBERS_PER_PROJECT: 30,
    MAX_STORAGE_BYTES: 5 * 1024 * 1024 * 1024, // 5 GB
    AI_FEATURES_ENABLED: true,
  },
} as const;

export function getPlanLimits(tier: PlanTier) {
  switch (tier) {
    case 'starter':
      return SUBSCRIPTION_LIMITS.STARTER;
    case 'pro':
      return SUBSCRIPTION_LIMITS.PRO;
    case 'free':
    default:
      return SUBSCRIPTION_LIMITS.FREE;
  }
}

export function formatBytes(bytes: number | null, decimals = 2) {
  if (bytes === null) return 'Ilimitado';
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Verifica si un usuario es premium
 */
export async function getUserPlanTier(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlanTier> {
  try {
    const { data, error } = await supabase.rpc('get_user_plan', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error getting user plan:', error);
      return 'free';
    }

    const tier = (data as string | null)?.toLowerCase();

    if (tier === 'starter' || tier === 'pro') {
      return tier;
    }

    return 'free';
  } catch (error) {
    console.error('Error getting user plan:', error);
    return 'free';
  }
}

export async function checkIsPremiumUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const tier = await getUserPlanTier(supabase, userId);
  return tier !== 'free';
}

export async function canUseAIFeatures(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('can_use_ai_features', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error checking AI feature access:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking AI feature access:', error);
    return false;
  }
}

/**
 * Obtiene el número actual de miembros en un proyecto
 */
export async function getProjectMemberCount(
  supabase: SupabaseClient,
  projectId: string,
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('project_members')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (error) {
      console.error('Error counting project members:', error);
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    console.error('Error counting project members:', error);
    return 0;
  }
}

/**
 * Verifica si se puede agregar un miembro al proyecto
 */
export async function canAddMemberToProject(
  supabase: SupabaseClient,
  projectId: string,
  ownerId: string,
): Promise<{
  canAdd: boolean;
  reason?: string;
  currentCount?: number;
  limit?: number | null;
  plan?: PlanTier;
}> {
  try {
    const { data, error } = await supabase.rpc('can_add_member_to_project', {
      p_project_id: projectId,
      p_owner_id: ownerId,
    });

    if (error || !data) {
      if (error) {
        console.error('Error checking member limits with RPC:', error);
      }
      return {
        canAdd: false,
        reason: 'No se pudo validar el límite de miembros',
      };
    }

    return {
      canAdd: data.can_add,
      reason: data.reason,
      currentCount: data.current_count,
      limit: data.limit,
      plan: normalizeTier(data.plan_tier),
    };
  } catch (error) {
    console.error('Error checking if can add member:', error);
    return {
      canAdd: false,
      reason: 'Error al verificar límites de miembros',
    };
  }
}

/**
 * Verifica si se puede agregar almacenamiento al proyecto
 */
export async function checkStorageLimit(
  supabase: SupabaseClient,
  projectId: string,
  newBytes: number,
): Promise<{
  canAdd: boolean;
  reason?: string;
  currentUsed?: number;
  limit?: number | null;
  plan?: PlanTier;
}> {
  try {
    // Obtener proyecto para ver si es premium y uso actual
    const { data: project, error } = await supabase
      .from('projects')
      .select('owner_id, storage_used')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      console.error('Error fetching project for storage check:', error);
      return { canAdd: false, reason: 'Error al verificar proyecto' };
    }

    const tier = await getUserPlanTier(supabase, project.owner_id);
    const limits = getPlanLimits(tier);
    const currentUsed = project.storage_used || 0;
    const limit = limits.MAX_STORAGE_BYTES;

    if (limit !== null && currentUsed + newBytes > limit) {
      return {
        canAdd: false,
        reason: `No hay suficiente espacio. Límite: ${formatBytes(limit)}, Usado: ${formatBytes(currentUsed)}, Intentando agregar: ${formatBytes(newBytes)}`,
        currentUsed,
        limit,
        plan: tier,
      };
    }

    return { canAdd: true, currentUsed, limit, plan: tier };
  } catch (error) {
    console.error('Error checking storage limit:', error);
    return {
      canAdd: false,
      reason: 'Error interno al verificar almacenamiento',
    };
  }
}

/**
 * Obtiene los límites de suscripción actuales para un usuario
 */
export async function getUserSubscriptionLimits(
  supabase: SupabaseClient,
  userId: string,
) {
  const tier = await getUserPlanTier(supabase, userId);
  const limits = getPlanLimits(tier);
  const isPaid = tier !== 'free';

  return {
    tier,
    isPaid,
    limits,
  };
}
