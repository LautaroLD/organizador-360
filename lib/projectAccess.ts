import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export type ProjectAccess = {
  userId: string;
  role: string;
  normalizedRole: string;
  isOwnerOrAdmin: boolean;
};

export async function requireAuthUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null as null,
      error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    };
  }

  return { user, error: null };
}

export async function requireProjectMember(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
) {
  const { data: member, error } = await supabase
    .from('project_members')
    .select('id, role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  if (error || !member) {
    return {
      member: null as null,
      access: null as null,
      error: NextResponse.json(
        { error: 'No tienes acceso a este proyecto' },
        { status: 403 },
      ),
    };
  }

  const normalizedRole = String(member.role ?? '').toLowerCase();
  const access: ProjectAccess = {
    userId,
    role: member.role,
    normalizedRole,
    isOwnerOrAdmin: normalizedRole === 'owner' || normalizedRole === 'admin',
  };

  return { member, access, error: null };
}

/** PRO team ops (approvals, audit, templates, etc.) — same gate as analytics/export. */
export async function requireProTeamOps(
  supabase: SupabaseClient,
  projectId: string,
  errorMessage =
    'Esta función de equipo está disponible solo para plan Pro',
) {
  const { data: canUse, error } = await supabase.rpc('can_use_project_analytics', {
    p_project_id: projectId,
  });

  if (error) {
    console.error('Error checking PRO team ops access:', error);
  }

  if (canUse !== true) {
    return {
      ok: false as const,
      error: NextResponse.json(
        {
          error: errorMessage,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, error: null };
}
