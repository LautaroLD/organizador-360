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
  _request: NextRequest,
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

    const pro = await requireProTeamOps(supabase, projectId);
    if (!pro.ok) return pro.error;

    const { data, error } = await supabase
      .from('approval_requests')
      .select(
        `
        *,
        requester:users!requester_id(id, name, email),
        reviewer:users!reviewer_id(id, name, email)
      `,
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error listing project approvals:', error);
      return NextResponse.json(
        { error: 'No se pudieron cargar las aprobaciones' },
        { status: 500 },
      );
    }

    const rows = data ?? [];
    const taskIds = rows
      .filter((r) => r.entity_type === 'task')
      .map((r) => r.entity_id);
    const titleById = new Map<string, string>();

    if (taskIds.length > 0) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title')
        .in('id', taskIds);
      for (const task of tasks ?? []) {
        titleById.set(task.id, task.title);
      }
    }

    const approvals = rows.map((row) => ({
      ...row,
      requester: unwrapRelation(row.requester),
      reviewer: unwrapRelation(row.reviewer),
      entity_title: titleById.get(row.entity_id) ?? null,
    }));

    return NextResponse.json({ approvals });
  } catch (error) {
    console.error('GET /api/projects/[id]/approvals error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
