import type { SupabaseClient } from '@supabase/supabase-js';
import {
  hasPermission,
  isPermission,
  type Permission,
  type PermissionOverride,
} from '@/lib/permissions';

export async function fetchMemberPermissionContext(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<{
  role: string | null;
  memberId: string | null;
  overrides: PermissionOverride[];
} | null> {
  const { data: member, error } = await supabase
    .from('project_members')
    .select('id, role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !member) {
    return null;
  }

  const { data: rows } = await supabase
    .from('project_member_permissions')
    .select('permission, granted')
    .eq('member_id', member.id);

  const overrides: PermissionOverride[] = (rows ?? [])
    .filter((row) => isPermission(row.permission))
    .map((row) => ({
      permission: row.permission as Permission,
      granted: Boolean(row.granted),
    }));

  return {
    role: member.role,
    memberId: member.id,
    overrides,
  };
}

export async function memberHasPermission(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  permission: Permission,
): Promise<boolean> {
  // Prefer DB function so API and RLS stay aligned.
  const { data, error } = await supabase.rpc('fn_member_has_permission', {
    p_project_id: projectId,
    p_permission: permission,
    p_user_id: userId,
  });

  if (!error && typeof data === 'boolean') {
    return data;
  }

  // Fallback if RPC is not migrated yet.
  const ctx = await fetchMemberPermissionContext(supabase, projectId, userId);
  if (!ctx) return false;
  return hasPermission(ctx.role, permission, ctx.overrides);
}
