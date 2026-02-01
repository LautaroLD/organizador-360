/**
 * Subscription Utilities
 * Funciones auxiliares para gestionar límites de suscripción
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';

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
    MAX_MEMBERS_PER_PROJECT: 20,
    MAX_STORAGE_BYTES: 5 * 1024 * 1024 * 1024, // 5 GB
    AI_FEATURES_ENABLED: true,
  },
  ENTERPRISE: {
    MAX_PROJECTS: null as number | null,
    MAX_MEMBERS_PER_PROJECT: null as number | null,
    MAX_STORAGE_BYTES: null as number | null,
    AI_FEATURES_ENABLED: true,
  },
} as const;

export function getPlanLimits(tier: PlanTier) {
  switch (tier) {
    case 'starter':
      return SUBSCRIPTION_LIMITS.STARTER;
    case 'pro':
      return SUBSCRIPTION_LIMITS.PRO;
    case 'enterprise':
      return SUBSCRIPTION_LIMITS.ENTERPRISE;
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
  userId: string
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
    if (tier === 'starter' || tier === 'pro' || tier === 'enterprise') {
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
  userId: string
): Promise<boolean> {
  const tier = await getUserPlanTier(supabase, userId);
  return tier !== 'free';
}

export async function canUseAIFeatures(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const tier = await getUserPlanTier(supabase, userId);
  return tier === 'pro' || tier === 'enterprise';
}

/**
 * Obtiene el número actual de miembros en un proyecto
 */
export async function getProjectMemberCount(
  supabase: SupabaseClient,
  projectId: string
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
  ownerId: string
): Promise<{ canAdd: boolean; reason?: string; currentCount?: number; limit?: number | null; plan?: PlanTier }> {
  try {
    // Try to use the database function first (more efficient)
    try {
      const { data, error } = await supabase.rpc('can_add_member_to_project', {
        p_project_id: projectId,
        p_owner_id: ownerId,
      });

      if (!error && data) {
        return {
          canAdd: data.can_add,
          reason: data.reason,
          currentCount: data.current_count,
          limit: data.limit,
        };
      }
    } catch {
      // Database function not available, using fallback logic
    }

    // Fallback to client-side logic
    // Verificar si el dueño es premium
    const tier = await getUserPlanTier(supabase, ownerId);
    const limits = getPlanLimits(tier);
    const limit = limits.MAX_MEMBERS_PER_PROJECT;

    // Verificar el límite
    const currentCount = await getProjectMemberCount(supabase, projectId);

    if (limit !== null && currentCount >= limit) {
      return {
        canAdd: false,
        reason: `Has alcanzado el límite de ${limit} miembros para el plan ${tier.toUpperCase()}.`,
        currentCount,
        limit,
        plan: tier,
      };
    }

    return { canAdd: true, currentCount, limit, plan: tier };
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
  newBytes: number
): Promise<{ canAdd: boolean; reason?: string; currentUsed?: number; limit?: number | null; plan?: PlanTier }> {
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
    return { canAdd: false, reason: 'Error interno al verificar almacenamiento' };
  }
}

/**
 * Obtiene los límites de suscripción actuales para un usuario
 */
export async function getUserSubscriptionLimits(
  supabase: SupabaseClient,
  userId: string
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
