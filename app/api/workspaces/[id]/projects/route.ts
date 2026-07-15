import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/projectAccess';
import {
  requireProWorkspaceAccess,
  requireWorkspaceOwner,
} from '@/lib/workspaceAccess';
import { seedDirectoryFromProjects } from '@/lib/workspaceService';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params;
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
    };

    const projectIds = Array.isArray(body.projectIds)
      ? [...new Set(body.projectIds.filter((id) => typeof id === 'string' && id))]
      : [];

    if (projectIds.length === 0) {
      return NextResponse.json(
        { error: 'Selecciona al menos un proyecto' },
        { status: 400 },
      );
    }

    const { data: owned } = await supabase
      .from('projects')
      .select('id, name, description, enabled, owner_id')
      .eq('owner_id', user.id)
      .in('id', projectIds);

    const ownedIds = new Set((owned ?? []).map((p) => p.id));
    const invalid = projectIds.filter((id) => !ownedIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: 'Solo puedes vincular proyectos que posees', invalid },
        { status: 403 },
      );
    }

    const { data: existing } = await supabase
      .from('workspace_projects')
      .select('project_id')
      .eq('workspace_id', workspaceId)
      .in('project_id', projectIds);

    const already = new Set((existing ?? []).map((r) => r.project_id));
    const toInsert = projectIds
      .filter((id) => !already.has(id))
      .map((project_id) => ({ workspace_id: workspaceId, project_id }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from('workspace_projects').insert(toInsert);
      if (error) {
        console.error('Error linking projects:', error);
        return NextResponse.json(
          { error: 'No se pudieron vincular los proyectos' },
          { status: 500 },
        );
      }

      await seedDirectoryFromProjects(
        supabase,
        workspaceId,
        toInsert.map((row) => row.project_id),
        user.email,
      );
    }

    const { data: links } = await supabase
      .from('workspace_projects')
      .select(
        `
        *,
        project:projects(id, name, description, enabled, owner_id)
      `,
      )
      .eq('workspace_id', workspaceId)
      .in('project_id', projectIds);

    return NextResponse.json({ projects: links ?? [] });
  } catch (error) {
    console.error('POST /api/workspaces/[id]/projects error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params;
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
      projectId?: string;
    };

    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });
    }

    const { error } = await supabase
      .from('workspace_projects')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('project_id', body.projectId);

    if (error) {
      console.error('Error unlinking project:', error);
      return NextResponse.json(
        { error: 'No se pudo desvincular el proyecto' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/workspaces/[id]/projects error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
