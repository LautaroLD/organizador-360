'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  hasPermission,
  type Permission,
  type PermissionOverride,
} from '@/lib/permissions';
import { useProjectStore } from '@/store/projectStore';

async function fetchMyOverrides(
  projectId: string,
  userId: string,
): Promise<PermissionOverride[]> {
  const supabase = createClient();
  const { data: member } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!member?.id) return [];

  const { data } = await supabase
    .from('project_member_permissions')
    .select('permission, granted')
    .eq('member_id', member.id);

  return (data ?? []).map((row) => ({
    permission: row.permission as Permission,
    granted: Boolean(row.granted),
  }));
}

export function useProjectPermissions(userId?: string | null) {
  const { currentProject } = useProjectStore();
  const role = currentProject?.userRole;
  const projectId = currentProject?.id;

  const { data: overrides = [] } = useQuery({
    queryKey: ['my-permissions', projectId, userId],
    queryFn: () => fetchMyOverrides(projectId!, userId!),
    enabled: !!projectId && !!userId,
    staleTime: 60_000,
  });

  const can = (permission: Permission) =>
    hasPermission(role, permission, overrides);

  return {
    role,
    overrides,
    can,
    canWriteChat: can('chat.write'),
    canEditKanban: can('kanban.edit'),
    canEditCalendar: can('calendar.edit'),
    canUploadResources: can('resources.upload'),
    canDeleteResources: can('resources.delete'),
    canInviteMembers: can('members.invite'),
    canManageMembers: can('members.manage'),
    canReviewApprovals: can('approvals.review'),
    canViewAudit: can('audit.view'),
  };
}
