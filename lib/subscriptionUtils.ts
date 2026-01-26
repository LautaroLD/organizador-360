/**
 * Subscription Utilities
 * Funciones auxiliares para gestionar límites de suscripción
 */

import { SupabaseClient } from '@supabase/supabase-js';

export const SUBSCRIPTION_LIMITS = {
  FREE: {
    MAX_PROJECTS: 3,
    MAX_MEMBERS_PER_PROJECT: 10,
    MAX_STORAGE_BYTES: 100 * 1024 * 1024, // 100 MB
    AI_FEATURES_ENABLED: false, // Sin acceso a funciones de IA
  },
  PRO: {
    MAX_PROJECTS: 10,
    MAX_MEMBERS_PER_PROJECT: 20,
    MAX_STORAGE_BYTES: 5 * 1024 * 1024 * 1024, // 5 GB
    AI_FEATURES_ENABLED: true, // Acceso completo a IA
  },
} as const;

export function formatBytes(bytes: number, decimals = 2) {
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
export async function checkIsPremiumUser(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_premium_user', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error checking premium status:', error);
      return false;
    }

    return data as boolean;
  } catch (error) {
    console.error('Error checking premium status:', error);
    return false;
  }
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
): Promise<{ canAdd: boolean; reason?: string; currentCount?: number; limit?: number }> {
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
    const isPremium = await checkIsPremiumUser(supabase, ownerId);

    // Obtener límite según el plan
    const limit = isPremium 
      ? SUBSCRIPTION_LIMITS.PRO.MAX_MEMBERS_PER_PROJECT 
      : SUBSCRIPTION_LIMITS.FREE.MAX_MEMBERS_PER_PROJECT;

    // Verificar el límite
    const currentCount = await getProjectMemberCount(supabase, projectId);

    if (currentCount >= limit) {
      return {
        canAdd: false,
        reason: `Has alcanzado el límite de ${limit} miembros para usuarios ${isPremium ? 'Pro' : 'Free'}.`,
        currentCount,
        limit,
      };
    }

    return { canAdd: true, currentCount, limit };
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
): Promise<{ canAdd: boolean; reason?: string; currentUsed?: number; limit?: number }> {
  try {
    // Obtener proyecto para ver si es premium y uso actual
    const { data: project, error } = await supabase
      .from('projects')
      .select('is_premium, storage_used')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      console.error('Error fetching project for storage check:', error);
      return { canAdd: false, reason: 'Error al verificar proyecto' };
    }

    const isPremium = project.is_premium;
    const currentUsed = project.storage_used || 0;
    const limit = isPremium 
      ? SUBSCRIPTION_LIMITS.PRO.MAX_STORAGE_BYTES 
      : SUBSCRIPTION_LIMITS.FREE.MAX_STORAGE_BYTES;

    if (currentUsed + newBytes > limit) {
      return {
        canAdd: false,
        reason: `No hay suficiente espacio. Límite: ${formatBytes(limit)}, Usado: ${formatBytes(currentUsed)}, Intentando agregar: ${formatBytes(newBytes)}`,
        currentUsed,
        limit
      };
    }

    return { canAdd: true, currentUsed, limit };
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
  const isPremium = await checkIsPremiumUser(supabase, userId);

  return {
    isPremium,
    limits: isPremium ? SUBSCRIPTION_LIMITS.PRO : SUBSCRIPTION_LIMITS.FREE,
  };
}
