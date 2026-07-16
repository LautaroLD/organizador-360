import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/projectAccess';
import {
  requireProWorkspaceAccess,
  requireWorkspaceOwner,
} from '@/lib/workspaceAccess';
import { assignWorkspaceMemberToProjects } from '@/lib/workspaceService';
import type { WorkspaceMember } from '@/models/workspace';

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId, memberId } = await context.params;
    const supabase = await createClient();
    const { user, error: authError } = await requireAuthUser(supabase);
    if (authError || !user) return authError!;

    const pro = await requireProWorkspaceAccess(supabase, user.id);
    if (!pro.ok) return pro.error;

    const { error: accessError } = await requireWorkspaceOwner(
      supabase,
      workspaceId,
      user.id,
    );
    if (accessError) return accessError;

    const body = (await request.json().catch(() => ({}))) as {
      projectIds?: string[];
      role?: 'Admin' | 'Collaborator' | 'Viewer';
    };

    const projectIds = Array.isArray(body.projectIds)
      ? body.projectIds.filter((id) => typeof id === 'string' && id)
      : [];

    if (projectIds.length === 0) {
      return NextResponse.json(
        { error: 'Selecciona al menos un proyecto' },
        { status: 400 },
      );
    }

    const role =
      body.role === 'Admin' || body.role === 'Viewer' || body.role === 'Collaborator'
        ? body.role
        : 'Collaborator';

    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 });
    }

    const result = await assignWorkspaceMemberToProjects({
      supabase,
      workspaceId,
      ownerId: user.id,
      member: member as WorkspaceMember,
      projectIds,
      role,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST assign workspace member error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
