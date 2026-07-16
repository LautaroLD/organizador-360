import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/projectAccess';
import {
  requireProWorkspaceAccess,
  requireWorkspaceOwner,
} from '@/lib/workspaceAccess';

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
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
      displayName?: string | null;
      orgRole?: string | null;
      skills?: string[];
    };

    const updates: Record<string, unknown> = {};
    if (body.displayName !== undefined) {
      updates.display_name =
        typeof body.displayName === 'string' ? body.displayName.trim() || null : null;
    }
    if (body.orgRole !== undefined) {
      updates.org_role =
        typeof body.orgRole === 'string' ? body.orgRole.trim() || null : null;
    }
    if (body.skills !== undefined) {
      updates.skills = Array.isArray(body.skills)
        ? body.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
        : [];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('workspace_members')
      .update(updates)
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)
      .select(
        `
        *,
        user:users(id, name, email, avatar_url)
      `,
      )
      .single();

    if (error || !data) {
      console.error('Error updating workspace member:', error);
      return NextResponse.json(
        { error: 'No se pudo actualizar el miembro' },
        { status: 500 },
      );
    }

    return NextResponse.json({ member: data });
  } catch (error) {
    console.error('PATCH /api/workspaces/[id]/members/[memberId] error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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

    const { data: member } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (member?.user_id === user.id) {
      return NextResponse.json(
        { error: 'No puedes eliminarte del directorio siendo el owner' },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error deleting workspace member:', error);
      return NextResponse.json(
        { error: 'No se pudo eliminar del directorio' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/workspaces/[id]/members/[memberId] error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
