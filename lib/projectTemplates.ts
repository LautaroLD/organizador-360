import type { SupabaseClient } from '@supabase/supabase-js';

export type ProjectTemplateId = 'startup' | 'agency' | 'product';

export type ProjectMemberRole = 'Owner' | 'Admin' | 'Collaborator' | 'Viewer';

export type TemplateRoleTag = {
  label: string;
  color: string;
  /** Roles that receive this tag automatically on join / template apply */
  assignToRoles: ProjectMemberRole[];
};

export type TemplateSeedTask = {
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'baja' | 'media' | 'alta' | null;
  checklist?: string[];
};

export type ProjectTemplate = {
  id: ProjectTemplateId;
  name: string;
  description: string;
  channels: Array<{ name: string; description: string }>;
  roleTags: TemplateRoleTag[];
  seedTasks: TemplateSeedTask[];
  /** First-7-days checklist seeded for each new non-owner member */
  memberOnboarding: {
    title: string;
    items: string[];
  };
};

export const ONBOARDING_TASK_TITLE = 'Onboarding: primeros 7 días';

export const ONBOARDING_WINDOW_DAYS = 7;

export const PROJECT_TEMPLATES: Record<ProjectTemplateId, ProjectTemplate> = {
  startup: {
    id: 'startup',
    name: 'Startup',
    description:
      'Canales de producto y growth, tags de rol y tareas iniciales para salir al mercado.',
    channels: [
      {
        name: 'producto',
        description: 'Priorización, discovery y decisiones de producto',
      },
      {
        name: 'growth',
        description: 'Adquisición, métricas y experimentos',
      },
      {
        name: 'standup',
        description: 'Sync diario del equipo',
      },
    ],
    roleTags: [
      {
        label: 'Founder',
        color: '#EAB308',
        assignToRoles: ['Owner', 'Admin'],
      },
      {
        label: 'Growth',
        color: '#8B5CF6',
        assignToRoles: ['Admin', 'Collaborator'],
      },
      {
        label: 'Engineering',
        color: '#22C55E',
        assignToRoles: ['Collaborator'],
      },
      {
        label: 'Observador',
        color: '#94A3B8',
        assignToRoles: ['Viewer'],
      },
    ],
    seedTasks: [
      {
        title: 'Definir problema y propuesta de valor',
        description: 'Alinear al equipo en el problema que resolvemos y para quién.',
        status: 'todo',
        priority: 'alta',
        checklist: [
          'Escribir problema en una frase',
          'Definir segmento objetivo',
          'Listar 3 hipótesis a validar',
        ],
      },
      {
        title: 'Armar MVP mínimo',
        description: 'Alcance del primer entregable usable.',
        status: 'todo',
        priority: 'alta',
        checklist: [
          'Listar features must-have',
          'Descartar nice-to-haves',
          'Asignar owners por área',
        ],
      },
      {
        title: 'Configurar métricas base',
        status: 'todo',
        priority: 'media',
        checklist: [
          'Elegir 1 métrica norte',
          'Definir check-in semanal de métricas',
        ],
      },
    ],
    memberOnboarding: {
      title: ONBOARDING_TASK_TITLE,
      items: [
        'Presentarte en el canal general',
        'Revisar la descripción del proyecto',
        'Completar tu primer check-in',
        'Revisar el tablero Kanban y comentar dudas',
        'Actualizar tu disponibilidad / calendario',
        'Elegir o pedir tus tags de rol',
        'Agendar sync con tu buddy o lead',
      ],
    },
  },
  agency: {
    id: 'agency',
    name: 'Agencia',
    description:
      'Estructura para clientes: briefing, creativos, entregas y revisión.',
    channels: [
      {
        name: 'clientes',
        description: 'Comunicación y estado por cuenta',
      },
      {
        name: 'creativos',
        description: 'Feedback de diseño y piezas',
      },
      {
        name: 'entregas',
        description: 'Deadlines y handoffs a cliente',
      },
    ],
    roleTags: [
      {
        label: 'Account',
        color: '#EAB308',
        assignToRoles: ['Owner', 'Admin'],
      },
      {
        label: 'Creativo',
        color: '#EC4899',
        assignToRoles: ['Collaborator'],
      },
      {
        label: 'Producción',
        color: '#22C55E',
        assignToRoles: ['Collaborator'],
      },
      {
        label: 'Cliente',
        color: '#94A3B8',
        assignToRoles: ['Viewer'],
      },
    ],
    seedTasks: [
      {
        title: 'Kickoff con cliente',
        description: 'Alinear alcance, tonos y entregables.',
        status: 'todo',
        priority: 'alta',
        checklist: [
          'Confirmar brief',
          'Definir stakeholders',
          'Acordar fechas de revisión',
        ],
      },
      {
        title: 'Moodboard / dirección creativa',
        status: 'todo',
        priority: 'alta',
        checklist: [
          'Recopilar referencias',
          'Validar dirección con account',
        ],
      },
      {
        title: 'Calendario de entregas',
        status: 'todo',
        priority: 'media',
        checklist: [
          'Listar hitos',
          'Asignar responsables',
          'Compartir con el cliente (viewer)',
        ],
      },
    ],
    memberOnboarding: {
      title: ONBOARDING_TASK_TITLE,
      items: [
        'Presentarte en el canal del equipo',
        'Leer el brief del proyecto / cliente',
        'Revisar canales de clientes y entregas',
        'Completar tu primer check-in',
        'Confirmar rol y tags con el account',
        'Revisar próximas entregas en el Kanban',
        'Configurar notificaciones de deadlines',
      ],
    },
  },
  product: {
    id: 'product',
    name: 'Producto',
    description:
      'Flujo producto–engineering: discovery, delivery, QA y soporte.',
    channels: [
      {
        name: 'discovery',
        description: 'Investigación, feedback y oportunidades',
      },
      {
        name: 'engineering',
        description: 'Implementación y dudas técnicas',
      },
      {
        name: 'qa',
        description: 'Bugs, regresiones y criterios de aceptación',
      },
    ],
    roleTags: [
      {
        label: 'PM',
        color: '#8B5CF6',
        assignToRoles: ['Owner', 'Admin'],
      },
      {
        label: 'Design',
        color: '#EC4899',
        assignToRoles: ['Collaborator'],
      },
      {
        label: 'Dev',
        color: '#22C55E',
        assignToRoles: ['Collaborator'],
      },
      {
        label: 'QA',
        color: '#0EA5E9',
        assignToRoles: ['Collaborator'],
      },
      {
        label: 'Stakeholder',
        color: '#94A3B8',
        assignToRoles: ['Viewer'],
      },
    ],
    seedTasks: [
      {
        title: 'Mapear journey del usuario',
        status: 'todo',
        priority: 'alta',
        checklist: [
          'Identificar pasos críticos',
          'Marcar fricciones conocidas',
        ],
      },
      {
        title: 'Definir sprint / ciclo actual',
        status: 'todo',
        priority: 'alta',
        checklist: [
          'Elegir objetivo del ciclo',
          'Priorizar backlog top 5',
          'Asignar owners',
        ],
      },
      {
        title: 'Criterios de done y QA',
        status: 'todo',
        priority: 'media',
        checklist: [
          'Documentar Definition of Done',
          'Definir flujo de revisión',
        ],
      },
    ],
    memberOnboarding: {
      title: ONBOARDING_TASK_TITLE,
      items: [
        'Presentarte en general y en tu canal de área',
        'Leer la descripción y objetivos del producto',
        'Revisar el Kanban y el ciclo actual',
        'Completar tu primer check-in',
        'Confirmar tags (PM / Design / Dev / QA)',
        'Revisar Definition of Done',
        'Agendar 1:1 corto con tu lead',
      ],
    },
  },
};

/** Fallback role tags when the project has no template marker */
export const DEFAULT_ROLE_TAGS: TemplateRoleTag[] = [
  {
    label: 'Liderazgo',
    color: '#EAB308',
    assignToRoles: ['Owner', 'Admin'],
  },
  {
    label: 'Equipo',
    color: '#22C55E',
    assignToRoles: ['Collaborator'],
  },
  {
    label: 'Observador',
    color: '#94A3B8',
    assignToRoles: ['Viewer'],
  },
];

export const GENERIC_MEMBER_ONBOARDING = {
  title: ONBOARDING_TASK_TITLE,
  items: [
    'Presentarte en el canal general',
    'Revisar la descripción del proyecto',
    'Completar tu primer check-in',
    'Explorar el tablero Kanban',
    'Revisar recursos compartidos',
    'Confirmar tu rol y tags con un admin',
    'Configurar notificaciones del proyecto',
  ],
};

export function isProjectTemplateId(value: unknown): value is ProjectTemplateId {
  return value === 'startup' || value === 'agency' || value === 'product';
}

export function listProjectTemplates(): ProjectTemplate[] {
  return Object.values(PROJECT_TEMPLATES);
}

export function getProjectTemplate(
  id: ProjectTemplateId,
): ProjectTemplate | null {
  return PROJECT_TEMPLATES[id] ?? null;
}

/** Detect which template was applied from its distinctive channel names. */
export function detectTemplateIdFromChannelNames(
  channelNames: string[],
): ProjectTemplateId | null {
  const names = new Set(channelNames.map((n) => n.toLowerCase()));
  const matches = (id: ProjectTemplateId) =>
    PROJECT_TEMPLATES[id].channels.every((ch) => names.has(ch.name.toLowerCase()));

  // Prefer the most specific match if several somehow overlap
  if (matches('startup')) return 'startup';
  if (matches('agency')) return 'agency';
  if (matches('product')) return 'product';
  return null;
}

export function tagsForRole(
  roleTags: TemplateRoleTag[],
  role: string,
): TemplateRoleTag[] {
  const normalized = role as ProjectMemberRole;
  return roleTags.filter((tag) => tag.assignToRoles.includes(normalized));
}

export function addDaysIso(from: Date, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

type ApplyTemplateResult = {
  templateId: ProjectTemplateId;
  channelsCreated: number;
  tagsCreated: number;
  tasksCreated: number;
};

export async function applyProjectTemplate(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    templateId: ProjectTemplateId;
    actorUserId: string;
  },
): Promise<ApplyTemplateResult> {
  const template = getProjectTemplate(params.templateId);
  if (!template) {
    throw new Error('Plantilla no encontrada');
  }

  await ensureProjectHasNoTemplate(supabase, params.projectId);

  const { data: existingChannels } = await supabase
    .from('channels')
    .select('name')
    .eq('project_id', params.projectId);

  const existingNames = new Set(
    (existingChannels ?? []).map((c) => String(c.name).toLowerCase()),
  );

  const channelsToInsert = template.channels.filter(
    (ch) => !existingNames.has(ch.name.toLowerCase()),
  );

  if (channelsToInsert.length > 0) {
    const { error: channelsError } = await supabase.from('channels').insert(
      channelsToInsert.map((ch) => ({
        project_id: params.projectId,
        name: ch.name,
        description: ch.description,
        created_by: params.actorUserId,
      })),
    );
    if (channelsError) throw channelsError;
  }

  const { data: existingTags } = await supabase
    .from('project_tags')
    .select('id, label')
    .eq('project_id', params.projectId);

  const tagsByLabel = new Map(
    (existingTags ?? []).map((t) => [String(t.label).toLowerCase(), t.id as number]),
  );

  const desiredTags: Array<{ label: string; color: string }> = template.roleTags.map(
    (t) => ({ label: t.label, color: t.color }),
  );

  let tagsCreated = 0;
  for (const tag of desiredTags) {
    if (tagsByLabel.has(tag.label.toLowerCase())) continue;
    const { data: created, error } = await supabase
      .from('project_tags')
      .insert({
        project_id: params.projectId,
        label: tag.label,
        color: tag.color,
      })
      .select('id, label')
      .single();
    if (error) throw error;
    tagsByLabel.set(String(created.label).toLowerCase(), created.id as number);
    tagsCreated += 1;
  }

  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('title')
    .eq('project_id', params.projectId);

  const existingTaskTitles = new Set(
    (existingTasks ?? []).map((t) => String(t.title).toLowerCase()),
  );

  let tasksCreated = 0;
  let position = existingTaskTitles.size;

  for (const seed of template.seedTasks) {
    if (existingTaskTitles.has(seed.title.toLowerCase())) continue;

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        project_id: params.projectId,
        title: seed.title,
        description: seed.description ?? null,
        status: seed.status,
        priority: seed.priority,
        position,
        created_by: params.actorUserId,
      })
      .select('id')
      .single();

    if (taskError) throw taskError;
    position += 1;
    tasksCreated += 1;
    existingTaskTitles.add(seed.title.toLowerCase());

    if (seed.checklist && seed.checklist.length > 0) {
      const { error: checklistError } = await supabase
        .from('task_checklist_items')
        .insert(
          seed.checklist.map((content, index) => ({
            task_id: task.id,
            content,
            is_completed: false,
            position: index,
          })),
        );
      if (checklistError) throw checklistError;
    }
  }

  // Auto-tag existing members by role (including Owner)
  const { data: members } = await supabase
    .from('project_members')
    .select('id, role')
    .eq('project_id', params.projectId);

  for (const member of members ?? []) {
    await assignRoleTagsToMember(supabase, {
      projectId: params.projectId,
      projectMemberId: member.id,
      role: String(member.role),
      roleTags: template.roleTags,
      tagsByLabel,
    });
  }

  return {
    templateId: params.templateId,
    channelsCreated: channelsToInsert.length,
    tagsCreated,
    tasksCreated,
  };
}

async function ensureRoleTagsExist(
  supabase: SupabaseClient,
  projectId: string,
  roleTags: TemplateRoleTag[],
): Promise<Map<string, number>> {
  const { data: existingTags } = await supabase
    .from('project_tags')
    .select('id, label')
    .eq('project_id', projectId);

  const tagsByLabel = new Map(
    (existingTags ?? []).map((t) => [String(t.label).toLowerCase(), t.id as number]),
  );

  for (const tag of roleTags) {
    if (tagsByLabel.has(tag.label.toLowerCase())) continue;
    const { data: created, error } = await supabase
      .from('project_tags')
      .insert({
        project_id: projectId,
        label: tag.label,
        color: tag.color,
      })
      .select('id, label')
      .single();
    if (error) throw error;
    tagsByLabel.set(String(created.label).toLowerCase(), created.id as number);
  }

  return tagsByLabel;
}

export async function assignRoleTagsToMember(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    projectMemberId: string;
    role: string;
    roleTags: TemplateRoleTag[];
    tagsByLabel?: Map<string, number>;
  },
): Promise<string[]> {
  const tagsByLabel =
    params.tagsByLabel ??
    (await ensureRoleTagsExist(supabase, params.projectId, params.roleTags));

  const matching = tagsForRole(params.roleTags, params.role);
  if (matching.length === 0) return [];

  const { data: existing } = await supabase
    .from('member_tags')
    .select('tag_id')
    .eq('project_member_id', params.projectMemberId);

  const existingTagIds = new Set((existing ?? []).map((r) => r.tag_id as number));
  const assigned: string[] = [];

  for (const tag of matching) {
    const tagId = tagsByLabel.get(tag.label.toLowerCase());
    if (!tagId || existingTagIds.has(tagId)) continue;

    const { error } = await supabase.from('member_tags').insert({
      project_member_id: params.projectMemberId,
      tag_id: tagId,
    });
    if (error) throw error;
    assigned.push(tag.label);
  }

  return assigned;
}

export async function detectProjectTemplateId(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectTemplateId | null> {
  const { data: channels } = await supabase
    .from('channels')
    .select('name')
    .eq('project_id', projectId);

  const fromChannels = detectTemplateIdFromChannelNames(
    (channels ?? []).map((c) => String(c.name)),
  );
  if (fromChannels) return fromChannels;

  // Fallback: audit trail (survives deleted template channels)
  const { data: log } = await supabase
    .from('audit_logs')
    .select('metadata')
    .eq('project_id', projectId)
    .eq('action', 'project.template_applied')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const templateId = (log?.metadata as { template_id?: unknown } | null)
    ?.template_id;
  return isProjectTemplateId(templateId) ? templateId : null;
}

export async function ensureProjectHasNoTemplate(
  supabase: SupabaseClient,
  projectId: string,
): Promise<void> {
  const existing = await detectProjectTemplateId(supabase, projectId);
  if (!existing) return;

  const name = getProjectTemplate(existing)?.name ?? existing;
  throw new Error(
    `Este proyecto ya tiene la plantilla "${name}". No se puede aplicar otra.`,
  );
}

export async function onboardProjectMember(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    userId: string;
    actorUserId: string;
    /** Skip onboarding task for Owner (still assigns tags) */
    skipOnboardingTaskForOwner?: boolean;
  },
): Promise<{
  tagsAssigned: string[];
  onboardingTaskCreated: boolean;
  templateId: ProjectTemplateId | null;
}> {
  const { data: member, error: memberError } = await supabase
    .from('project_members')
    .select('id, role, joined_at, user_id')
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId)
    .single();

  if (memberError || !member) {
    throw new Error('Miembro no encontrado en el proyecto');
  }

  const templateId = await detectProjectTemplateId(supabase, params.projectId);
  const template = templateId ? getProjectTemplate(templateId) : null;
  const roleTags = template?.roleTags ?? DEFAULT_ROLE_TAGS;
  const onboarding = template?.memberOnboarding ?? GENERIC_MEMBER_ONBOARDING;

  const tagsAssigned = await assignRoleTagsToMember(supabase, {
    projectId: params.projectId,
    projectMemberId: member.id,
    role: String(member.role),
    roleTags,
  });

  const isOwner = String(member.role).toLowerCase() === 'owner';
  if (isOwner && params.skipOnboardingTaskForOwner !== false) {
    return {
      tagsAssigned,
      onboardingTaskCreated: false,
      templateId,
    };
  }

  // Avoid duplicate onboarding tasks for this user
  const { data: assignedTasks } = await supabase
    .from('task_assignments')
    .select('task_id, task:tasks!inner(id, title, project_id)')
    .eq('user_id', params.userId);

  const alreadyHasOnboarding = (assignedTasks ?? []).some((row) => {
    const task = Array.isArray(row.task) ? row.task[0] : row.task;
    return (
      task &&
      task.project_id === params.projectId &&
      String(task.title) === onboarding.title
    );
  });

  if (alreadyHasOnboarding) {
    return {
      tagsAssigned,
      onboardingTaskCreated: false,
      templateId,
    };
  }

  const joinedAt = member.joined_at ? new Date(member.joined_at) : new Date();
  const dueAt = addDaysIso(joinedAt, ONBOARDING_WINDOW_DAYS);

  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', params.projectId);

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      project_id: params.projectId,
      title: onboarding.title,
      description:
        'Checklist de tus primeros 7 días en el proyecto. Completalo a tu ritmo; tu lead puede ver el progreso.',
      status: 'todo',
      priority: 'media',
      position: count ?? 0,
      created_by: params.actorUserId,
      done_estimated_at: dueAt,
    })
    .select('id')
    .single();

  if (taskError) throw taskError;

  const { error: assignError } = await supabase.from('task_assignments').insert({
    task_id: task.id,
    user_id: params.userId,
  });
  if (assignError) throw assignError;

  if (onboarding.items.length > 0) {
    const { error: checklistError } = await supabase
      .from('task_checklist_items')
      .insert(
        onboarding.items.map((content, index) => ({
          task_id: task.id,
          content,
          is_completed: false,
          position: index,
        })),
      );
    if (checklistError) throw checklistError;
  }

  return {
    tagsAssigned,
    onboardingTaskCreated: true,
    templateId,
  };
}

export type MemberOnboardingProgress = {
  userId: string;
  taskId: string;
  totalItems: number;
  completedItems: number;
  dueAt: string | null;
  status: string;
  percent: number;
  isOverdue: boolean;
};

export function computeOnboardingProgress(params: {
  userId: string;
  taskId: string;
  status: string;
  doneEstimatedAt: string | null;
  checklist: Array<{ is_completed: boolean }>;
  now?: Date;
}): MemberOnboardingProgress {
  const totalItems = params.checklist.length;
  const completedItems = params.checklist.filter((i) => i.is_completed).length;
  const percent =
    totalItems === 0 ? (params.status === 'done' ? 100 : 0) : Math.round((completedItems / totalItems) * 100);
  const now = params.now ?? new Date();
  const due = params.doneEstimatedAt ? new Date(params.doneEstimatedAt) : null;
  const isOverdue = Boolean(
    due && due.getTime() < now.getTime() && params.status !== 'done' && percent < 100,
  );

  return {
    userId: params.userId,
    taskId: params.taskId,
    totalItems,
    completedItems,
    dueAt: params.doneEstimatedAt,
    status: params.status,
    percent,
    isOverdue,
  };
}
