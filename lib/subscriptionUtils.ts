/**
 * Subscription Utilities
 * Funciones auxiliares para gestionar límites de suscripción
 */

import { SupabaseClient } from '@supabase/supabase-js';

export const SUBSCRIPTION_LIMITS = {
  FREE: {
    MAX_MEMBERS_PER_PROJECT: 10,
  },
  PRO: {
    MAX_MEMBERS_PER_PROJECT: Infinity,
  },
} as const;

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
    } catch (dbError) {
      console.log('Database function not available, using fallback logic:', dbError);
    }

    // Fallback to client-side logic
    // Verificar si el dueño es premium
    const isPremium = await checkIsPremiumUser(supabase, ownerId);

    // Si es premium, no hay límite
    if (isPremium) {
      return { canAdd: true };
    }

    // Si es free, verificar el límite
    const currentCount = await getProjectMemberCount(supabase, projectId);
    const limit = SUBSCRIPTION_LIMITS.FREE.MAX_MEMBERS_PER_PROJECT;

    if (currentCount >= limit) {
      return {
        canAdd: false,
        reason: `Has alcanzado el límite de ${limit} miembros para usuarios Free. Actualiza a Pro para agregar más miembros.`,
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
