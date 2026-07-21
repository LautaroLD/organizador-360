import { ai } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';
import { AICreditError, consumeAICredits } from '@/lib/aiCredits';

type AgentHistoryMessage = {
  role: 'assistant' | 'user';
  content: string;
};

type MemberTag = {
  tag?:
    | {
        label?: string | null;
      }
    | {
        label?: string | null;
      }[]
    | null;
};

type ProjectMember = {
  role?: string | null;
  users?:
    | {
        email?: string | null;
      }
    | {
        email?: string | null;
      }[]
    | null;
  tags?: MemberTag[] | null;
};

type ResourceItem = {
  type?: string | null;
  title?: string | null;
  created_at?: string | null;
};

type EventItem = {
  start_date?: string | null;
  end_date?: string | null;
  title?: string | null;
  description?: string | null;
};

type ChatMessage = {
  created_at?: string | null;
  content?: string | null;
  users?:
    | {
        email?: string | null;
      }
    | {
        email?: string | null;
      }[]
    | null;
};

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

type ApprovalRow = {
  entity_type?: string | null;
  entity_id?: string | null;
  status?: ApprovalStatus | null;
  request_note?: string | null;
  created_at?: string | null;
  requester?:
    | { email?: string | null; name?: string | null }
    | { email?: string | null; name?: string | null }[]
    | null;
  reviewer?:
    | { email?: string | null; name?: string | null }
    | { email?: string | null; name?: string | null }[]
    | null;
};

type TaskAssignmentRow = {
  user?:
    | { email?: string | null; name?: string | null }
    | { email?: string | null; name?: string | null }[]
    | null;
};

type TaskTagRow = {
  tag?:
    | { label?: string | null }
    | { label?: string | null }[]
    | null;
};

type TaskChecklistRow = {
  content?: string | null;
  is_completed?: boolean | null;
};

type AgentTask = {
  id?: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  done_estimated_at?: string | null;
  done_at?: string | null;
  phase_roadmap_id?: number | null;
  epic_id?: string | null;
  assignments?: TaskAssignmentRow[] | null;
  tags?: TaskTagRow[] | null;
  checklist?: TaskChecklistRow[] | null;
};

type ApprovalContext = {
  status: ApprovalStatus;
  label: string;
  reviewer: string;
  requester: string;
  note: string;
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'Por hacer',
  'in-progress': 'En progreso',
  done: 'Hecha',
};

const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  pending: 'Pendiente de revisión',
  blocked: 'Bloqueada (pendiente de revisión)',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatPerson(
  value:
    | { email?: string | null; name?: string | null }
    | { email?: string | null; name?: string | null }[]
    | null
    | undefined,
): string {
  const person = unwrapRelation(value);
  if (!person) return 'Desconocido';
  return person.name || person.email || 'Desconocido';
}

function formatDate(value?: string | null): string {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-ES');
}

function truncateText(value: string, max = 220): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function buildApprovalMap(rows: ApprovalRow[]): Map<string, ApprovalContext> {
  const map = new Map<string, ApprovalContext>();

  for (const row of rows) {
    if (row.entity_type !== 'task' || !row.entity_id || !row.status) continue;
    // First (newest) wins due to order created_at desc
    if (map.has(row.entity_id)) continue;

    map.set(row.entity_id, {
      status: row.status,
      label: APPROVAL_LABELS[row.status],
      reviewer: formatPerson(row.reviewer),
      requester: formatPerson(row.requester),
      note: row.request_note ? truncateText(row.request_note, 120) : '',
    });
  }

  return map;
}

function serializeTask(
  task: AgentTask,
  approvalByTaskId: Map<string, ApprovalContext>,
  phaseLabels: Record<number, string>,
  epicLabels: Record<string, string>,
): string {
  const assignees = (task.assignments || [])
    .map((assignment) => formatPerson(assignment.user))
    .filter((name) => name !== 'Desconocido')
    .join(', ');

  const tags = (task.tags || [])
    .map((row) => unwrapRelation(row.tag)?.label)
    .filter((label): label is string => Boolean(label))
    .join(', ');

  const checklist = task.checklist || [];
  const checklistDone = checklist.filter((item) => item.is_completed).length;
  const checklistSummary =
    checklist.length > 0 ? `${checklistDone}/${checklist.length}` : 'Sin checklist';

  const approval = task.id ? approvalByTaskId.get(task.id) : undefined;
  const approvalText = approval
    ? `${approval.label} (solicitó: ${approval.requester}; revisor: ${approval.reviewer}${
        approval.note ? `; nota: ${approval.note}` : ''
      })`
    : 'Sin solicitud de revisión';

  const statusLabel = STATUS_LABELS[task.status || ''] || task.status || 'Sin estado';
  const phaseLabel =
    typeof task.phase_roadmap_id === 'number'
      ? phaseLabels[task.phase_roadmap_id] || `Fase ${task.phase_roadmap_id}`
      : 'Sin fase';
  const epicLabel = task.epic_id
    ? epicLabels[task.epic_id] || 'Épica desconocida'
    : 'Sin épica';

  const dueLabel = task.done_estimated_at
    ? formatDate(task.done_estimated_at)
    : 'Sin fecha de cierre';
  const doneLabel = task.done_at ? formatDate(task.done_at) : null;

  return [
    `* Título: ${task.title || 'Sin título'}`,
    `Estado kanban: ${statusLabel}`,
    `Revisión: ${approvalText}`,
    `Prioridad: ${task.priority || 'Sin prioridad'}`,
    `Asignados: ${assignees || 'Sin asignar'}`,
    `Cierre estimado: ${dueLabel}`,
    doneLabel ? `Completada el: ${doneLabel}` : null,
    `Épica: ${epicLabel}`,
    `Fase: ${phaseLabel}`,
    `Tags: ${tags || 'Sin tags'}`,
    `Checklist: ${checklistSummary}`,
    `Descripción: ${
      task.description ? truncateText(task.description) : 'Sin descripción'
    }`,
  ]
    .filter(Boolean)
    .join(' | ');
}

export async function POST(req: NextRequest) {
  try {
    const { message, history, projectId, requestId } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Verificar que el usuario esté autenticado
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar que el usuario sea premium
    const canUseAI = await canUseAIFeatures(supabase, user.id);
    if (!canUseAI) {
      return NextResponse.json(
        { error: 'Esta función está disponible solo para plan Pro' },
        { status: 403 },
      );
    }

    // Nivel 3: 1 crédito por mensaje del asistente general
    await consumeAICredits(supabase, {
      userId: user.id,
      action: 'agent_message',
      projectId,
      idempotencyKey:
        typeof requestId === 'string' && requestId
          ? requestId
          : crypto.randomUUID(),
      metadata: {
        endpoint: '/api/ia/agent',
      },
    });

    // 1. Obtener datos básicos del proyecto
    const { data: project } = await supabase
      .from('projects')
      .select('name, description')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Obtener canales del proyecto para buscar mensajes
    const { data: channels } = await supabase
      .from('channels')
      .select('id, name')
      .eq('project_id', projectId);

    const channelIds = channels?.map((c) => c.id) || [];

    // 3. Ejecutar consultas en paralelo para optimizar tiempo
    const [
      tasksResult,
      messagesResult,
      membersResult,
      resourcesResult,
      eventsResult,
      approvalsResult,
      epicsResult,
      roadmapResult,
    ] = await Promise.all([
      // Tareas recientes (limitado a 100 para tener contexto suficiente)
      supabase
        .from('tasks')
        .select(
          `
          id,
          title,
          description,
          status,
          priority,
          done_estimated_at,
          done_at,
          phase_roadmap_id,
          epic_id,
          created_at,
          assignments:task_assignments(
            user_id,
            user:users(id, name, email)
          ),
          checklist:task_checklist_items(id, content, is_completed),
          tags:task_tags(
            id,
            tag_id,
            tag:project_tags(label)
          )
        `,
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(100),

      // Mensajes recientes de cualquier canal del proyecto
      channelIds.length > 0
        ? supabase
            .from('messages')
            .select('content, user_id, created_at, users:user_id(email)')
            .in('channel_id', channelIds)
            .order('created_at', { ascending: false })
            .limit(50)
        : { data: [] },

      // Miembros del equipo
      supabase
        .from('project_members')
        .select(
          `user_id, role,
            users:user_id(email),
            tags:member_tags (
            id,
            tag_id,
            tag:project_tags (
              id,
              label,
              color
            )
          )`,
        )
        .eq('project_id', projectId),

      // Archivos/Recursos recientes
      supabase
        .from('resources')
        .select('title, type, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(30),

      // Eventos del calendario (Próximos)
      supabase
        .from('events')
        .select('title, start_date, end_date, description')
        .eq('project_id', projectId)
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(20),

      // Solicitudes de aprobación/revisión (más recientes primero)
      supabase
        .from('approval_requests')
        .select(
          `
          entity_type,
          entity_id,
          status,
          request_note,
          created_at,
          requester:users!requester_id(name, email),
          reviewer:users!reviewer_id(name, email)
        `,
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(100),

      supabase
        .from('epics')
        .select('id, title')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(100),

      supabase
        .from('roadmap')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle(),
    ]);

    const tasks = (tasksResult.data || []) as AgentTask[];
    const chatMessages = messagesResult.data || [];
    const members = membersResult.data || [];
    const resources = resourcesResult.data || [];
    const events = eventsResult.data || [];
    const approvals = (approvalsResult.data || []) as ApprovalRow[];
    const epics = epicsResult.data || [];
    const roadmap = roadmapResult.data;

    let phases: Array<{ id: number; name?: string | null }> = [];
    if (roadmap?.id) {
      const { data: phaseRows } = await supabase
        .from('phase_roadmap')
        .select('id, name')
        .eq('roadmap_id', roadmap.id)
        .order('id');
      phases = phaseRows || [];
    }

    const approvalByTaskId = buildApprovalMap(approvals);
    const epicLabels = Object.fromEntries(
      epics.map((epic: { id: string; title?: string | null }) => [
        epic.id,
        epic.title || 'Épica sin nombre',
      ]),
    );
    const phaseLabels = Object.fromEntries(
      phases.map((phase) => [phase.id, phase.name || `Fase ${phase.id}`]),
    );

    const pendingReviewCount = [...approvalByTaskId.values()].filter(
      (a) => a.status === 'pending' || a.status === 'blocked',
    ).length;

    // 4. Construir el contexto limitado y relevante
    const contextText = `
    DATOS DEL PROYECTO:
    Nombre: ${project.name}
    Descripción: ${project.description}

    MIEMBROS DEL EQUIPO:
    ${members
      .map((m: ProjectMember) => {
        const user = Array.isArray(m.users) ? m.users[0] : m.users;
        const tags = (m.tags || [])
          .map((memberTag: MemberTag) => {
            const rawTag = Array.isArray(memberTag.tag)
              ? memberTag.tag[0]
              : memberTag.tag;
            return rawTag?.label || null;
          })
          .filter((label): label is string => Boolean(label))
          .join(', ');

        return `- ${user?.email || 'Sin email'} (rol: ${m.role || 'Sin rol'}) - (tags: ${tags || 'Sin tags'})`;
      })
      .join('\n')}

    ARCHIVOS Y RECURSOS DISPONIBLES (Últimos 30):
    ${resources
      .map(
        (r: ResourceItem) =>
          `- [${r.type}] ${r.title} (${r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Sin fecha'})`,
      )
      .join('\n')}

    PRÓXIMOS EVENTOS (Calendario):
    ${events
      .map(
        (e: EventItem) =>
          `- [${e.start_date ? new Date(e.start_date).toLocaleString() : 'Sin fecha'} - ${e.end_date ? new Date(e.end_date).toLocaleTimeString() : 'Sin hora'}] ${e.title}: ${e.description || 'Sin descripción'}`,
      )
      .join('\n')}

    TAREAS DEL PROYECTO (${tasks.length} recientes; ${pendingReviewCount} en revisión o bloqueadas):
    ${tasks
      .map((t) => serializeTask(t, approvalByTaskId, phaseLabels, epicLabels))
      .join('\n')}

    ÚLTIMOS MENSAJES DE CHAT (Contexto de conversación):
    ${[...chatMessages]
      .reverse()
      .map((m: ChatMessage) => {
        const user = Array.isArray(m.users) ? m.users[0] : m.users;
        return `[${m.created_at}] ${user?.email || 'Usuario'}: ${m.content}`;
      })
      .join('\n')}
    `;

    // 5. Llamada a Gemini
    // Construimos el historial de conversación para Gemini
    const conversationHistory =
      history?.map((msg: AgentHistoryMessage) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })) || [];

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        { role: 'user', parts: [{ text: contextText }] },
        ...conversationHistory,
        {
          role: 'user',
          parts: [{ text: `Pregunta actual del usuario: ${message}` }],
        },
      ],
      config: {
        systemInstruction: `Eres el Asistente de IA oficial del proyecto "${project.name}".
        La fecha actual es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

        Tu objetivo es ayudar al equipo respondiendo preguntas sobre el estado del proyecto, tareas y conversaciones pasadas.
        Solo puedes informar y analizar con el contexto provisto. No tienes herramientas: no puedes crear, editar ni eliminar tareas; no puedes notificar ni mensajear miembros; no puedes cambiar estados, asignaciones, aprobaciones, eventos ni recursos.

        INSTRUCCIONES:
        1. Usa el contexto del proyecto provisto en la conversación para responder. Si la información no está disponible, indícalo claramente.
        2. Sé conciso y directo. Usa listas o tablas cuando la respuesta tenga múltiples elementos.
        3. No propongas acciones que no puedas ejecutar tú mismo (por ejemplo: "creo la tarea", "notifico a X", "asigno a Y", "marco como hecha", "pido revisión"). En su lugar, responde con hechos, prioridades o hallazgos basados en los datos.
        4. Si el usuario pide explícitamente ideas de tareas o un plan, puedes listar sugerencias de texto como ideas (no como acciones que vas a realizar) y aclara que debe crearlas o aplicarlas manualmente en la app.
        5. Puedes analizar el sentimiento del equipo basado en el historial de chat.
        6. Mantén el hilo de la conversación si el usuario hace referencias a mensajes anteriores.
        7. Para fechas de eventos, usa la fecha actual como referencia para indicar cuánto falta.
        8. Distingue siempre el estado kanban (Por hacer / En progreso / Hecha) del estado de revisión/aprobación (Pendiente de revisión, Bloqueada, Aprobada, Rechazada). Una tarea puede estar "Hecha" y aún "Pendiente de revisión".
        9. Cuando pregunten por tareas pendientes de revisión, usa el campo "Revisión" de cada tarea.
        10. Considera asignados, fechas de cierre estimado, épicas, fases, tags y checklist al priorizar o resumir trabajo.
        
        Responde siempre en español.
        `,
      },
    });

    const responseText = response.text;

    return NextResponse.json({
      response: responseText,
      usedContext: {
        taskCount: tasks.length,
        messageCount: chatMessages.length,
        pendingReviewCount,
      },
    });
  } catch (error) {
    if (error instanceof AICreditError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          creditStatus: error.details
            ? {
                remaining: error.details.remaining,
                required: error.details.cost,
                quota: error.details.quota,
              }
            : undefined,
        },
        { status: error.status },
      );
    }

    console.error('Error in AI agent:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
