import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/projectAccess';

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await requireAuthUser(supabase);
    if (authError || !user) return authError!;

    const { data: pending, error } = await supabase
      .from('approval_requests')
      .select(
        `
        *,
        project:projects(name),
        requester:users!requester_id(id, name, email)
      `,
      )
      .eq('reviewer_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching pending approvals:', error);
      return NextResponse.json(
        { error: 'No se pudieron cargar las aprobaciones' },
        { status: 500 },
      );
    }

    const rows = pending ?? [];
    const taskIds = rows
      .filter((r) => r.entity_type === 'task')
      .map((r) => r.entity_id);
    const resourceIds = rows
      .filter((r) => r.entity_type === 'resource')
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

    if (resourceIds.length > 0) {
      const { data: resources } = await supabase
        .from('resources')
        .select('id, title')
        .in('id', resourceIds);
      for (const resource of resources ?? []) {
        titleById.set(resource.id, resource.title);
      }
    }

    const approvals = rows.map((row) => ({
      ...row,
      project: unwrapRelation(row.project),
      requester: unwrapRelation(row.requester),
      entity_title: titleById.get(row.entity_id) ?? null,
    }));

    return NextResponse.json({ approvals });
  } catch (error) {
    console.error('GET /api/approvals/pending error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
