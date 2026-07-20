import { PlanTier } from '@/types/planTypes';
import { SupabaseClient } from '@supabase/supabase-js';

export type SubscriptionProvider = 'lemon_squeezy';

type lemon_squeezyStatus = 'authorized' | 'pending' | 'paused' | 'cancelled';

type SubscriptionAccessSnapshot = {
  status?: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;
};

export type PlanLimits = {
  max_projects: number;
  max_members_per_project: number;
  max_storage_bytes: number;
  ai_features_enabled: boolean;
  ai_monthly_credits: number;
  workspace_enabled: boolean;
  google_calendar_sync: boolean;
};

/** Display/offline fallback only — must stay aligned with plans.limits seed. */
export const FALLBACK_PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    max_projects: 3,
    max_members_per_project: 10,
    max_storage_bytes: 100 * 1024 * 1024,
    ai_features_enabled: false,
    ai_monthly_credits: 0,
    workspace_enabled: false,
    google_calendar_sync: false,
  },
  starter: {
    max_projects: 5,
    max_members_per_project: 15,
    max_storage_bytes: 1024 * 1024 * 1024,
    ai_features_enabled: false,
    ai_monthly_credits: 0,
    workspace_enabled: false,
    google_calendar_sync: false,
  },
  pro: {
    max_projects: 10,
    max_members_per_project: 30,
    max_storage_bytes: 5 * 1024 * 1024 * 1024,
    ai_features_enabled: true,
    ai_monthly_credits: 250,
    workspace_enabled: true,
    google_calendar_sync: true,
  },
};

const KNOWN_PAID_TIERS: ReadonlyArray<PlanTier> = ['starter', 'pro'];

function normalizeTier(value?: string | null): PlanTier {
  const normalized = value?.toLowerCase();
  if (normalized === 'starter' || normalized === 'pro') {
    return normalized;
  }
  return 'free';
}

export function parsePlanLimits(value: unknown): PlanLimits {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const numberOr = (key: string, fallback: number) => {
    const n = Number(raw[key]);
    return Number.isFinite(n) ? n : fallback;
  };

  const boolOr = (key: string, fallback: boolean) => {
    const v = raw[key];
    if (typeof v === 'boolean') return v;
    if (v === 'true') return true;
    if (v === 'false') return false;
    return fallback;
  };

  const fallback = FALLBACK_PLAN_LIMITS.free;

  return {
    max_projects: numberOr('max_projects', fallback.max_projects),
    max_members_per_project: numberOr(
      'max_members_per_project',
      fallback.max_members_per_project,
    ),
    max_storage_bytes: numberOr('max_storage_bytes', fallback.max_storage_bytes),
    ai_features_enabled: boolOr(
      'ai_features_enabled',
      fallback.ai_features_enabled,
    ),
    ai_monthly_credits: numberOr(
      'ai_monthly_credits',
      fallback.ai_monthly_credits,
    ),
    workspace_enabled: boolOr('workspace_enabled', fallback.workspace_enabled),
    google_calendar_sync: boolOr(
      'google_calendar_sync',
      fallback.google_calendar_sync,
    ),
  };
}

/** Merge base plan limits with a partial variant override (override wins). */
export function mergePlanLimits(
  base: PlanLimits,
  override?: unknown | null,
): PlanLimits {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return base;
  }

  const raw = override as Record<string, unknown>;
  const next: PlanLimits = { ...base };

  const assignNumber = (key: keyof PlanLimits) => {
    if (!(key in raw) || raw[key] === null || raw[key] === undefined) return;
    const n = Number(raw[key]);
    if (Number.isFinite(n)) {
      (next as Record<string, number | boolean>)[key] = n;
    }
  };

  const assignBool = (key: keyof PlanLimits) => {
    if (!(key in raw) || raw[key] === null || raw[key] === undefined) return;
    const v = raw[key];
    if (typeof v === 'boolean') {
      (next as Record<string, number | boolean>)[key] = v;
    } else if (v === 'true') {
      (next as Record<string, number | boolean>)[key] = true;
    } else if (v === 'false') {
      (next as Record<string, number | boolean>)[key] = false;
    }
  };

  assignNumber('max_projects');
  assignNumber('max_members_per_project');
  assignNumber('max_storage_bytes');
  assignNumber('ai_monthly_credits');
  assignBool('ai_features_enabled');
  assignBool('workspace_enabled');
  assignBool('google_calendar_sync');

  return next;
}

/**
 * Build marketing bullets from effective limits, preserving non-quota lines
 * from the catalog (IA, sync, soporte, etc.).
 */
export function buildDisplayFeatures(
  limits: PlanLimits,
  catalogFeatures: string[] = [],
): string[] {
  const projectsLine = `Hasta ${limits.max_projects} proyectos`;
  const storageLine = `Hasta ${formatBytes(limits.max_storage_bytes, 0)} de recursos`;
  const membersLine = `Hasta ${limits.max_members_per_project} miembros por proyecto`;

  if (catalogFeatures.length === 0) {
    return [projectsLine, storageLine, membersLine];
  }

  let sawProjects = false;
  let sawStorage = false;
  let sawMembers = false;

  const mapped = catalogFeatures.map((feature) => {
    const lower = feature.toLowerCase();
    if (lower.includes('hasta') && lower.includes('miembro')) {
      sawMembers = true;
      return membersLine;
    }
    if (lower.includes('hasta') && lower.includes('recurso')) {
      sawStorage = true;
      return storageLine;
    }
    if (
      lower.includes('hasta') &&
      lower.includes('proyecto') &&
      !lower.includes('miembro')
    ) {
      sawProjects = true;
      return projectsLine;
    }
    return feature;
  });

  const prefix: string[] = [];
  if (!sawProjects) prefix.push(projectsLine);
  if (!sawStorage) prefix.push(storageLine);
  if (!sawMembers) prefix.push(membersLine);

  return [...prefix, ...mapped];
}

/** Sync fallback by tier for UI that only has a denormalized plan_tier. */
export function getFallbackPlanLimits(tier: PlanTier): PlanLimits {
  return FALLBACK_PLAN_LIMITS[tier] ?? FALLBACK_PLAN_LIMITS.free;
}

/** @deprecated Use getFallbackPlanLimits / getEffectiveLimits */
export function getPlanLimits(tier: PlanTier) {
  const limits = getFallbackPlanLimits(tier);
  return {
    MAX_PROJECTS: limits.max_projects,
    MAX_MEMBERS_PER_PROJECT: limits.max_members_per_project,
    MAX_STORAGE_BYTES: limits.max_storage_bytes,
    AI_FEATURES_ENABLED: limits.ai_features_enabled,
  };
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

export function formatBytes(bytes: number | null, decimals = 2) {
  if (bytes === null) return 'Ilimitado';
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

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

export async function getEffectiveLimits(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ tier: PlanTier; limits: PlanLimits }> {
  const tier = await getUserPlanTier(supabase, userId);

  try {
    const { data, error } = await supabase.rpc('get_effective_limits', {
      p_user_id: userId,
    });

    if (error || data == null) {
      if (error) {
        console.error('Error getting effective limits:', error);
      }
      return { tier, limits: getFallbackPlanLimits(tier) };
    }

    return { tier, limits: parsePlanLimits(data) };
  } catch (error) {
    console.error('Error getting effective limits:', error);
    return { tier, limits: getFallbackPlanLimits(tier) };
  }
}

export async function getPlanLimitsByCode(
  supabase: SupabaseClient,
  code: PlanTier | string,
): Promise<PlanLimits> {
  const tier = normalizeTier(code);

  try {
    const { data, error } = await supabase
      .from('plans')
      .select('limits')
      .eq('code', tier)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.error('Error loading plan limits by code:', error);
      }
      return getFallbackPlanLimits(tier);
    }

    return parsePlanLimits(data.limits);
  } catch (error) {
    console.error('Error loading plan limits by code:', error);
    return getFallbackPlanLimits(tier);
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
    const { data: project, error } = await supabase
      .from('projects')
      .select('owner_id, storage_used')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      console.error('Error fetching project for storage check:', error);
      return { canAdd: false, reason: 'Error al verificar proyecto' };
    }

    const { tier, limits } = await getEffectiveLimits(
      supabase,
      project.owner_id,
    );
    const currentUsed = project.storage_used || 0;
    const limit = limits.max_storage_bytes;

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

export async function getUserSubscriptionLimits(
  supabase: SupabaseClient,
  userId: string,
) {
  const { tier, limits } = await getEffectiveLimits(supabase, userId);
  const isPaid = tier !== 'free';

  return {
    tier,
    isPaid,
    limits: {
      MAX_PROJECTS: limits.max_projects,
      MAX_MEMBERS_PER_PROJECT: limits.max_members_per_project,
      MAX_STORAGE_BYTES: limits.max_storage_bytes,
      AI_FEATURES_ENABLED: limits.ai_features_enabled,
    },
  };
}
