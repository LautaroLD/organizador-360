import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuthUser,
  requireProTeamOps,
  requireProjectMember,
} from '@/lib/projectAccess';

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { user, error: authError } = await requireAuthUser(supabase);
    if (authError || !user) return authError!;

    const { access, error: memberError } = await requireProjectMember(
      supabase,
      projectId,
      user.id,
    );
    if (memberError || !access) return memberError!;

    if (!access.isOwnerOrAdmin) {
      return NextResponse.json(
        { error: 'Solo Owner o Admin pueden ver el audit log' },
        { status: 403 },
      );
    }

    const pro = await requireProTeamOps(supabase, projectId);
    if (!pro.ok) return pro.error;

    const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '50');
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 200)
      : 50;

    const { data, error } = await supabase
      .from('audit_logs')
      .select(
        `
        *,
        actor:users!actor_id(id, name, email)
      `,
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error listing audit logs:', error);
      return NextResponse.json(
        { error: 'No se pudo cargar el historial' },
        { status: 500 },
      );
    }

    const logs = (data ?? []).map((row) => ({
      ...row,
      actor: unwrapRelation(row.actor),
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    }));

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('GET /api/projects/[id]/audit error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { user, error: authError } = await requireAuthUser(supabase);
    if (authError || !user) return authError!;

    const { access, error: memberError } = await requireProjectMember(
      supabase,
      projectId,
      user.id,
    );
    if (memberError || !access) return memberError!;

    const body = (await request.json().catch(() => null)) as {
      action?: string;
      entityType?: string;
      entityId?: string;
      metadata?: Record<string, unknown>;
    } | null;

    if (!body?.action) {
      return NextResponse.json(
        { error: 'action es requerido' },
        { status: 400 },
      );
    }

    const allowedClientActions = new Set([
      'resource.delete',
      'task.delete',
      'member.role_change',
      'member.remove',
    ]);

    if (!allowedClientActions.has(body.action)) {
      return NextResponse.json(
        { error: 'Acción de auditoría no permitida desde el cliente' },
        { status: 400 },
      );
    }

    const { error } = await supabase.from('audit_logs').insert({
      project_id: projectId,
      actor_id: user.id,
      action: body.action,
      entity_type: body.entityType ?? null,
      entity_id: body.entityId ?? null,
      metadata: body.metadata ?? {},
    });

    if (error) {
      console.error('Error inserting client audit log:', error);
      return NextResponse.json(
        { error: 'No se pudo registrar la auditoría' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/projects/[id]/audit error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
