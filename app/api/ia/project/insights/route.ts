import { ai } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { projectId, phaseSummary } = await req.json();

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
        .select('id,title,status,created_at,updated_at,done_at,done_estimated_at,priority')
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

    const getMedian = (values: number[]) => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
      }
      return sorted[mid];
    };

    const avgDurationMs = completedDurations.length
      ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
      : 0;

    const medianDurationMs = getMedian(completedDurations);

    const tasksByMember: Record<string, number> = {};
    const tasksByMemberDetails: Record<string, typeof tasks> = {};
    const taskById = new Map(tasks.map((t) => [t.id, t]));

    (assignments ?? []).forEach((a) => {
      tasksByMember[a.user_id] = (tasksByMember[a.user_id] || 0) + 1;
      const task = taskById.get(a.task_id);
      if (!task) return;
      if (!tasksByMemberDetails[a.user_id]) {
        tasksByMemberDetails[a.user_id] = [];
      }
      tasksByMemberDetails[a.user_id].push(task);
    });

    const estimatedDoneDeltas = tasks
      .filter((t) => t.status === 'done' && t.done_estimated_at && t.done_at)
      .map((t) => {
        const estimatedAt = new Date(t.done_estimated_at as string).getTime();
        const doneAt = new Date(t.done_at as string).getTime();
        if (Number.isNaN(estimatedAt) || Number.isNaN(doneAt)) return null;
        return doneAt - estimatedAt;
      })
      .filter((v): v is number => v !== null);

    const avgEstimateDeltaMs = estimatedDoneDeltas.length
      ? Math.round(estimatedDoneDeltas.reduce((a, b) => a + b, 0) / estimatedDoneDeltas.length)
      : 0;
    const onTimeCount = estimatedDoneDeltas.filter((v) => v <= 0).length;
    const lateCount = estimatedDoneDeltas.filter((v) => v > 0).length;

    const phaseSummaryText = Array.isArray(phaseSummary) && phaseSummary.length > 0
      ? `\nEstado por fases:\n${phaseSummary.map((phase) => (
        `- ${phase.name}: ${phase.progress}% (${phase.done}/${phase.total}) | En progreso ${phase.inProgress} | Pendientes ${phase.todo}`
      )).join('\n')}`
      : '';

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
- Desvio promedio cierre estimado (ms): ${avgEstimateDeltaMs}
- En plazo (estimado vs real): ${onTimeCount}
- Con retraso (estimado vs real): ${lateCount}
- Tareas con estimacion completadas: ${estimatedDoneDeltas.length}
${phaseSummaryText}

Tareas por miembro:
${members.map((m) => {
  const rawUser = Array.isArray(m.user) ? m.user[0] : m.user;
  const name = rawUser?.name || rawUser?.email || 'Sin nombre';
  const count = tasksByMember[m.user_id] || 0;
  const taskDetails = (tasksByMemberDetails[m.user_id] || [])
    .map((task) => {
      const status = task.status;
      const estimatedAt = task.done_estimated_at ? new Date(task.done_estimated_at).toISOString().split('T')[0] : 'Sin fecha';
      const doneAt = task.done_at ? new Date(task.done_at).toISOString().split('T')[0] : 'Sin fecha';
      const closeText = status === 'done' ? `Cerrado: ${doneAt}` : `Cierre estimado: ${estimatedAt}`;
      return `  - ${task.title} [${status}] | ${closeText}`;
    })
    .join('\n');
  const tags = (m.tags || [])
    .map((t) => {
      const rawTag = Array.isArray(t.tag) ? t.tag[0] : t.tag;
      return rawTag?.label;
    })
    .filter(Boolean)
    .join(', ');
  const tagsText = tags ? ` | tags: ${tags}` : '';
  const tasksText = taskDetails ? `\n${taskDetails}` : '';
  return `- ${name} (${m.role}): ${count}${tagsText}${tasksText}`;
}).join('\n')}

Comparacion cierre estimado vs real (tareas completadas):
${tasks
  .filter((t) => t.done_estimated_at && t.done_at)
  .map((t) => {
    const estimatedAt = new Date(t.done_estimated_at as string).toISOString().split('T')[0];
    const doneAt = new Date(t.done_at as string).toISOString().split('T')[0];
    const deltaMs = new Date(t.done_at as string).getTime() - new Date(t.done_estimated_at as string).getTime();
    return `- ${t.title}: Estimado ${estimatedAt} | Real ${doneAt} | Delta(ms) ${deltaMs}`;
  })
  .join('\n')}
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
