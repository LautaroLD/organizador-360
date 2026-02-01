import { ai } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: member, error: memberError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 });
    }

    if (member.role !== 'Owner' && member.role !== 'Admin') {
      return NextResponse.json({ error: 'Solo Owner o Admin pueden acceder' }, { status: 403 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id,name,description,plan_tier')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    if (project.plan_tier !== 'enterprise') {
      return NextResponse.json({ error: 'Disponible solo para Enterprise' }, { status: 403 });
    }

    const [tasksRes, membersRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('id,status,created_at,updated_at,done_at,priority')
        .eq('project_id', projectId),
      supabase
        .from('project_members')
        .select('id,user_id, role, user:users(name,email), tags:member_tags(tag:project_tags(label,color))')
        .eq('project_id', projectId),
    ]);

    const tasks = tasksRes.data || [];
    const members = (membersRes.data ?? []) as Array<{
      id: string;
      user_id: string;
      role: string;
      user: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null;
      tags: { tag: { label: string | null; color: string | null } | { label: string | null; color: string | null }[] | null }[] | null;
    }>;
    const taskIds = tasks.map((t) => t.id);

    const { data: assignments } = taskIds.length > 0
      ? await supabase
        .from('task_assignments')
        .select('task_id,user_id,user:users(name,email)')
        .in('task_id', taskIds)
      : { data: [] };

    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
    const todo = tasks.filter((t) => t.status === 'todo').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    const completedDurations = tasks
      .filter((t) => t.status === 'done')
      .map((t) => {
        const created = new Date(t.created_at).getTime();
        const doneAt = t.done_at ? new Date(t.done_at).getTime() : NaN;
        if (Number.isNaN(created) || Number.isNaN(doneAt)) return null;
        if (doneAt <= created) return null;
        return doneAt - created;
      })
      .filter((v): v is number => v !== null);

    const avgDurationMs = completedDurations.length
      ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
      : 0;

    const medianDurationMs = completedDurations.length
      ? [...completedDurations].sort((a, b) => a - b)[Math.floor(completedDurations.length / 2)]
      : 0;

    const tasksByMember: Record<string, number> = {};
    (assignments ?? []).forEach((a) => {
      tasksByMember[a.user_id] = (tasksByMember[a.user_id] || 0) + 1;
    });

    const summaryText = `
Proyecto: ${project.name}
Descripción: ${project.description || 'Sin descripción'}

Métricas:
- Total tareas: ${total}
- Completadas: ${done}
- En progreso: ${inProgress}
- Por hacer: ${todo}
- Avance: ${progress}%
- Duración promedio (ms): ${Math.round(avgDurationMs)}
- Duración mediana (ms): ${Math.round(medianDurationMs)}

Tareas por miembro:
${members.map((m) => {
  const rawUser = Array.isArray(m.user) ? m.user[0] : m.user;
  const name = rawUser?.name || rawUser?.email || 'Sin nombre';
  const count = tasksByMember[m.user_id] || 0;
  const tags = (m.tags || [])
    .map((t) => {
      const rawTag = Array.isArray(t.tag) ? t.tag[0] : t.tag;
      return rawTag?.label;
    })
    .filter(Boolean)
    .join(', ');
  const tagsText = tags ? ` | tags: ${tags}` : '';
  return `- ${name} (${m.role}): ${count}${tagsText}`;
}).join('\n')}
`;
console.log(summaryText);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: summaryText }] }],
      config: {
        systemInstruction: `Eres un analista de proyectos. Resume el estado actual y da 3-5 recomendaciones accionables.
Responde en español con:
1) Estado actual (breve)
2) Riesgos/alertas
3) Recomendaciones (bullets)
`,
      }
    });

    return NextResponse.json({ summary: response.text });
  } catch (error) {
    console.error('Error generating analytics insights:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
