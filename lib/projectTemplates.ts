import type { SupabaseClient } from '@supabase/supabase-js';

export type ProjectTemplateId = 'startup' | 'agency' | 'product';

export type ProjectMemberRole = 'Owner' | 'Admin' | 'Collaborator' | 'Viewer';

export type TemplateRoleTag = {
  label: string;
  color: string;
  /** Roles that receive this tag automatically on join / template apply */
  assignToRoles: ProjectMemberRole[];
};

export type TemplateSeedPhase = {
  name: string;
  description?: string;
  /** Days from apply date for phase start (date-only) */
  startOffsetDays: number;
  /** Days from apply date for phase end (date-only) */
  endOffsetDays: number;
};

export type TemplateSeedTask = {
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'baja' | 'media' | 'alta' | null;
  checklist?: string[];
  /** Index into template.phases */
  phaseIndex?: number;
  /** Due date offset in days from apply */
  dueOffsetDays?: number;
  /** Assign the applying actor (typically the owner) */
  assignToActor?: boolean;
};

export type ProjectTemplate = {
  id: ProjectTemplateId;
  name: string;
  description: string;
  /** Prefills project description when the field is empty */
  suggestedDescription: string;
  channels: Array<{ name: string; description: string }>;
  roleTags: TemplateRoleTag[];
  phases: TemplateSeedPhase[];
  seedTasks: TemplateSeedTask[];
  /** First-7-days checklist seeded for each new non-owner member */
  memberOnboarding: {
    title: string;
    items: string[];
  };
};

export type TemplatePreviewStats = {
  channels: number;
  tags: number;
  tasks: number;
  phases: number;
  onboardingDays: number;
};

export const ONBOARDING_TASK_TITLE = 'Onboarding: primeros 7 días';

export const ONBOARDING_WINDOW_DAYS = 7;

export const PROJECT_TEMPLATES: Record<ProjectTemplateId, ProjectTemplate> = {
  startup: {
    id: 'startup',
    name: 'Startup',
    description:
      'Validación → MVP → launch: canales, roadmap, métricas y onboarding para salir al mercado.',
    suggestedDescription: [
      '## Objetivo',
      'Validar el problema, armar un MVP usable y medir tracción inicial.',
      '',
      '## Cómo usamos los canales',
      '- **#producto** — priorización, discovery y decisiones de producto',
      '- **#growth** — adquisición, métricas y experimentos',
      '- **#standup** — sync diario del equipo',
      '',
      '## Rituales',
      '- Check-in semanal de la métrica norte',
      '- Standup corto en #standup',
    ].join('\n'),
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
        label: 'Fundador',
        color: '#EAB308',
        assignToRoles: ['Owner', 'Admin'],
      },
      {
        label: 'Crecimiento',
        color: '#8B5CF6',
        assignToRoles: [],
      },
      {
        label: 'Ingeniería',
        color: '#22C55E',
        assignToRoles: [],
      },
      {
        label: 'Observador',
        color: '#94A3B8',
        assignToRoles: ['Viewer'],
      },
    ],
    phases: [
      {
        name: 'Validación',
        description: 'Problema, segmento e hipótesis a validar',
        startOffsetDays: 0,
        endOffsetDays: 7,
      },
      {
        name: 'MVP',
        description: 'Alcance mínimo y primer entregable usable',
        startOffsetDays: 7,
        endOffsetDays: 21,
      },
      {
        name: 'Launch',
        description: 'Salida al mercado y primeros usuarios',
        startOffsetDays: 21,
        endOffsetDays: 35,
      },
      {
        name: 'Growth',
        description: 'Experimentos y métricas de tracción',
        startOffsetDays: 35,
        endOffsetDays: 49,
      },
    ],
    seedTasks: [
      {
        title: 'Definir problema y propuesta de valor',
        description: 'Alinear al equipo en el problema que resolvemos y para quién.',
        status: 'in-progress',
        priority: 'alta',
        phaseIndex: 0,
        dueOffsetDays: 3,
        assignToActor: true,
        checklist: [
          'Escribir problema en una frase',
          'Definir segmento objetivo',
          'Listar 3 hipótesis a validar',
        ],
      },
      {
        title: 'Entrevistar 5 usuarios potenciales',
        description: 'Validar el problema con conversaciones reales.',
        status: 'todo',
        priority: 'alta',
        phaseIndex: 0,
        dueOffsetDays: 7,
        checklist: [
          'Armar guion de entrevista',
          'Agendar 5 conversaciones',
          'Sintetizar aprendizajes en #producto',
        ],
      },
      {
        title: 'Armar MVP mínimo',
        description: 'Alcance del primer entregable usable.',
        status: 'todo',
        priority: 'alta',
        phaseIndex: 1,
        dueOffsetDays: 14,
        checklist: [
          'Listar features must-have',
          'Descartar nice-to-haves',
          'Asignar owners por área',
        ],
      },
      {
        title: 'Configurar métricas base',
        description: 'Elegir la métrica norte y el ritual de seguimiento.',
        status: 'todo',
        priority: 'media',
        phaseIndex: 1,
        dueOffsetDays: 10,
        checklist: [
          'Elegir 1 métrica norte',
          'Definir cómo se calcula',
          'Definir check-in semanal de métricas',
        ],
      },
      {
        title: 'Preparar landing / waitlist',
        description: 'Canal para capturar interés antes o durante el launch.',
        status: 'todo',
        priority: 'media',
        phaseIndex: 2,
        dueOffsetDays: 21,
        checklist: [
          'Definir mensaje principal',
          'Publicar CTA de captura',
          'Conectar notificación al equipo',
        ],
      },
      {
        title: 'Plan de launch (semana 1)',
        description: 'Acciones concretas para los primeros días en mercado.',
        status: 'todo',
        priority: 'alta',
        phaseIndex: 2,
        dueOffsetDays: 28,
        checklist: [
          'Lista de early adopters a contactar',
          'Post de anuncio listo',
          'Canal de soporte definido',
        ],
      },
      {
        title: 'Correr primer experimento de growth',
        description: 'Un experimento acotado con hipótesis y métrica.',
        status: 'todo',
        priority: 'media',
        phaseIndex: 3,
        dueOffsetDays: 42,
        checklist: [
          'Escribir hipótesis',
          'Definir métrica de éxito',
          'Compartir resultado en #growth',
        ],
      },
    ],
    memberOnboarding: {
      title: ONBOARDING_TASK_TITLE,
      items: [
        'Presentarte en #general y #standup',
        'Leer la descripción del proyecto (objetivos y canales)',
        'Completar tu primer check-in',
        'Revisar el roadmap (fase Validación / MVP) y el Kanban',
        'Comentar en la tarea de propuesta de valor o métricas',
        'Pedir tus tags de rol (Crecimiento / Ingeniería) a un admin',
        'Agendar sync corto con tu lead',
      ],
    },
  },
  agency: {
    id: 'agency',
    name: 'Agencia',
    description:
      'Brief → concepto → producción → entrega: estructura para cuentas y deadlines de cliente.',
    suggestedDescription: [
      '## Objetivo',
      'Entregar el trabajo del cliente a tiempo, con feedback claro y handoffs ordenados.',
      '',
      '## Cómo usamos los canales',
      '- **#clientes** — comunicación y estado por cuenta',
      '- **#creativos** — feedback de diseño y piezas',
      '- **#entregas** — deadlines y handoffs a cliente',
      '',
      '## Rituales',
      '- Kickoff y revisiones con fechas acordadas',
      '- Cliente como Viewer en entregas clave',
    ].join('\n'),
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
        assignToRoles: [],
      },
      {
        label: 'Producción',
        color: '#22C55E',
        assignToRoles: [],
      },
      {
        label: 'Cliente',
        color: '#94A3B8',
        assignToRoles: ['Viewer'],
      },
    ],
    phases: [
      {
        name: 'Brief',
        description: 'Alcance, tonos y stakeholders',
        startOffsetDays: 0,
        endOffsetDays: 5,
      },
      {
        name: 'Concepto',
        description: 'Dirección creativa y validación',
        startOffsetDays: 5,
        endOffsetDays: 14,
      },
      {
        name: 'Producción',
        description: 'Ejecución de piezas y entregables',
        startOffsetDays: 14,
        endOffsetDays: 28,
      },
      {
        name: 'Entrega',
        description: 'Revisión final y handoff al cliente',
        startOffsetDays: 28,
        endOffsetDays: 35,
      },
    ],
    seedTasks: [
      {
        title: 'Kickoff con cliente',
        description: 'Alinear alcance, tonos y entregables.',
        status: 'in-progress',
        priority: 'alta',
        phaseIndex: 0,
        dueOffsetDays: 3,
        assignToActor: true,
        checklist: [
          'Confirmar brief',
          'Definir stakeholders',
          'Acordar fechas de revisión',
        ],
      },
      {
        title: 'Documentar brief del cliente',
        description: 'Dejar alcance, tonos y entregables claros para el equipo.',
        status: 'todo',
        priority: 'alta',
        phaseIndex: 0,
        dueOffsetDays: 5,
        checklist: [
          'Escribir objetivos y audiencia',
          'Listar entregables acordados',
          'Compartir resumen en #clientes',
        ],
      },
      {
        title: 'Moodboard / dirección creativa',
        description: 'Referencias y tono visual/verbal.',
        status: 'todo',
        priority: 'alta',
        phaseIndex: 1,
        dueOffsetDays: 10,
        checklist: [
          'Recopilar referencias',
          'Validar dirección con Account',
          'Publicar síntesis en #creativos',
        ],
      },
      {
        title: 'Calendario de entregas',
        description: 'Hitos visibles en roadmap y Kanban.',
        status: 'todo',
        priority: 'media',
        phaseIndex: 1,
        dueOffsetDays: 12,
        checklist: [
          'Revisar fechas de cada fase del roadmap',
          'Asignar responsables por entrega',
          'Avisar deadlines en #entregas',
        ],
      },
      {
        title: 'Producción de piezas v1',
        description: 'Primer set de entregables para revisión interna.',
        status: 'todo',
        priority: 'alta',
        phaseIndex: 2,
        dueOffsetDays: 21,
        checklist: [
          'Listar piezas del paquete',
          'Revisión interna Account + Creativo',
          'Adjuntar o linkear borradores en la tarea',
        ],
      },
      {
        title: 'Ronda de feedback con cliente',
        description: 'Consolidar comentarios y próximos cambios.',
        status: 'todo',
        priority: 'media',
        phaseIndex: 2,
        dueOffsetDays: 25,
        checklist: [
          'Enviar v1 al cliente',
          'Recoger feedback en un solo hilo',
          'Priorizar cambios must-have',
        ],
      },
      {
        title: 'Entrega final y handoff',
        description: 'Cierre, archivos finales y follow-up.',
        status: 'todo',
        priority: 'alta',
        phaseIndex: 3,
        dueOffsetDays: 35,
        checklist: [
          'Empaquetar entregables finales',
          'Confirmar recepción con el cliente',
          'Retro corta del equipo en #entregas',
        ],
      },
    ],
    memberOnboarding: {
      title: ONBOARDING_TASK_TITLE,
      items: [
        'Presentarte en #general y en #clientes',
        'Leer la descripción y el brief del proyecto',
        'Revisar canales #creativos y #entregas',
        'Completar tu primer check-in',
        'Confirmar rol/tags (Creativo o Producción) con Account',
        'Revisar el roadmap y próximas entregas en el Kanban',
        'Activar notificaciones de deadlines del proyecto',
      ],
    },
  },
  product: {
    id: 'product',
    name: 'Producto',
    description:
      'Discovery → build → QA → release: flujo producto–engineering con DoD y soporte.',
    suggestedDescription: [
      '## Objetivo',
      'Descubrir, construir y releasear valor con criterios de done claros.',
      '',
      '## Cómo usamos los canales',
      '- **#discovery** — investigación, feedback y oportunidades',
      '- **#engineering** — implementación y dudas técnicas',
      '- **#qa** — bugs, regresiones y criterios de aceptación',
      '',
      '## Rituales',
      '- Ciclo / sprint con objetivo explícito',
      '- Revisión contra Definition of Done antes de release',
    ].join('\n'),
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
        label: 'Diseño',
        color: '#EC4899',
        assignToRoles: [],
      },
      {
        label: 'Dev',
        color: '#22C55E',
        assignToRoles: [],
      },
      {
        label: 'QA',
        color: '#0EA5E9',
        assignToRoles: [],
      },
      {
        label: 'Stakeholder',
        color: '#94A3B8',
        assignToRoles: ['Viewer'],
      },
    ],
    phases: [
      {
        name: 'Discovery',
        description: 'Problemas, journey y oportunidades',
        startOffsetDays: 0,
        endOffsetDays: 10,
      },
      {
        name: 'Build',
        description: 'Implementación del ciclo actual',
        startOffsetDays: 10,
        endOffsetDays: 24,
      },
      {
        name: 'QA',
        description: 'Validación, bugs y aceptación',
        startOffsetDays: 24,
        endOffsetDays: 31,
      },
      {
        name: 'Release',
        description: 'Salida a producción y seguimiento',
        startOffsetDays: 31,
        endOffsetDays: 38,
      },
    ],
    seedTasks: [
      {
        title: 'Mapear journey del usuario',
        description: 'Pasos críticos y fricciones conocidas.',
        status: 'in-progress',
        priority: 'alta',
        phaseIndex: 0,
        dueOffsetDays: 5,
        assignToActor: true,
        checklist: [
          'Identificar pasos críticos',
          'Marcar fricciones conocidas',
          'Compartir hallazgos en #discovery',
        ],
      },
      {
        title: 'Priorizar oportunidades del ciclo',
        description: 'Elegir qué entra al backlog inmediato.',
        status: 'todo',
        priority: 'alta',
        phaseIndex: 0,
        dueOffsetDays: 8,
        checklist: [
          'Listar oportunidades top 10',
          'Elegir top 5 del ciclo',
          'Alinear con stakeholders (Viewer)',
        ],
      },
      {
        title: 'Definir sprint / ciclo actual',
        description: 'Objetivo del ciclo, owners y alcance.',
        status: 'todo',
        priority: 'alta',
        phaseIndex: 1,
        dueOffsetDays: 12,
        checklist: [
          'Elegir objetivo del ciclo',
          'Priorizar backlog top 5',
          'Asignar owners',
        ],
      },
      {
        title: 'Criterios de done y QA',
        description: 'Definition of Done y flujo de revisión.',
        status: 'todo',
        priority: 'media',
        phaseIndex: 1,
        dueOffsetDays: 14,
        checklist: [
          'Documentar Definition of Done en la descripción de la tarea',
          'Definir flujo de revisión',
          'Publicar resumen en #qa',
        ],
      },
      {
        title: 'Implementar historias del ciclo',
        description: 'Trabajo de engineering del alcance acordado.',
        status: 'todo',
        priority: 'alta',
        phaseIndex: 1,
        dueOffsetDays: 24,
        checklist: [
          'Crear tareas hijas / subtareas si hace falta',
          'Actualizar estado en el Kanban',
          'Documentar dudas en #engineering',
        ],
      },
      {
        title: 'Pasada de QA y regresiones',
        description: 'Validar aceptación antes del release.',
        status: 'todo',
        priority: 'alta',
        phaseIndex: 2,
        dueOffsetDays: 28,
        checklist: [
          'Ejecutar checklist de aceptación',
          'Registrar bugs en #qa',
          'Confirmar DoD cumplido',
        ],
      },
      {
        title: 'Release y notas de versión',
        description: 'Salida a producción y comunicación.',
        status: 'todo',
        priority: 'media',
        phaseIndex: 3,
        dueOffsetDays: 35,
        checklist: [
          'Checklist de release',
          'Notas de versión para stakeholders',
          'Plan de monitoreo post-release',
        ],
      },
    ],
    memberOnboarding: {
      title: ONBOARDING_TASK_TITLE,
      items: [
        'Presentarte en #general y en tu canal de área (#discovery, #engineering o #qa)',
        'Leer la descripción y objetivos del producto',
        'Revisar el roadmap (ciclo actual) y el Kanban',
        'Completar tu primer check-in',
        'Pedir tus tags (Diseño / Dev / QA) a un admin',
        'Revisar la tarea de Definition of Done',
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
    'Explorar el tablero Kanban y el roadmap (si existe)',
    'Revisar las tareas iniciales del proyecto',
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

export function getTemplatePreviewStats(
  template: ProjectTemplate,
): TemplatePreviewStats {
  return {
    channels: template.channels.length,
    tags: template.roleTags.length,
    tasks: template.seedTasks.length,
    phases: template.phases.length,
    onboardingDays: ONBOARDING_WINDOW_DAYS,
  };
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

export function addDaysDateOnly(from: Date, days: number): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type ApplyTemplateResult = {
  templateId: ProjectTemplateId;
  channelsCreated: number;
  tagsCreated: number;
  tasksCreated: number;
  phasesCreated: number;
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

  const appliedAt = new Date();

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

  const phaseIdsByIndex = await ensureTemplateRoadmapPhases(supabase, {
    projectId: params.projectId,
    phases: template.phases,
    appliedAt,
  });

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

    const phaseId =
      seed.phaseIndex !== undefined ? phaseIdsByIndex.get(seed.phaseIndex) ?? null : null;

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
        phase_roadmap_id: phaseId,
        done_estimated_at:
          seed.dueOffsetDays !== undefined
            ? addDaysIso(appliedAt, seed.dueOffsetDays)
            : null,
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

    if (seed.assignToActor) {
      const { error: assignError } = await supabase.from('task_assignments').insert({
        task_id: task.id,
        user_id: params.actorUserId,
      });
      if (assignError) throw assignError;
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

  const { error: templateIdError } = await supabase
    .from('projects')
    .update({ template_id: params.templateId })
    .eq('id', params.projectId);
  if (templateIdError) {
    // Allow apply to succeed before the template_id migration is pushed;
    // detection still works via channels + audit metadata.
    const message = templateIdError.message || '';
    if (!/template_id|schema cache|column/i.test(message)) {
      throw templateIdError;
    }
  }

  // Prefill empty project description with the template suggestion
  const { data: projectRow } = await supabase
    .from('projects')
    .select('description')
    .eq('id', params.projectId)
    .maybeSingle();

  const currentDescription = String(projectRow?.description ?? '').trim();
  if (!currentDescription && template.suggestedDescription) {
    const { error: descriptionError } = await supabase
      .from('projects')
      .update({ description: template.suggestedDescription })
      .eq('id', params.projectId);
    if (descriptionError) throw descriptionError;
  }

  return {
    templateId: params.templateId,
    channelsCreated: channelsToInsert.length,
    tagsCreated,
    tasksCreated,
    phasesCreated: phaseIdsByIndex.size,
  };
}

async function ensureTemplateRoadmapPhases(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    phases: TemplateSeedPhase[];
    appliedAt: Date;
  },
): Promise<Map<number, number>> {
  const phaseIdsByIndex = new Map<number, number>();
  if (params.phases.length === 0) return phaseIdsByIndex;

  let roadmapId: number | null = null;

  const { data: existingRoadmap, error: roadmapLookupError } = await supabase
    .from('roadmap')
    .select('id')
    .eq('project_id', params.projectId)
    .maybeSingle();

  if (roadmapLookupError) throw roadmapLookupError;

  if (existingRoadmap?.id) {
    roadmapId = existingRoadmap.id as number;
  } else {
    const { data: createdRoadmap, error: roadmapError } = await supabase
      .from('roadmap')
      .insert({ project_id: params.projectId })
      .select('id')
      .single();
    if (roadmapError) throw roadmapError;
    roadmapId = createdRoadmap.id as number;
  }

  const { data: existingPhases, error: phasesLookupError } = await supabase
    .from('phase_roadmap')
    .select('id, name')
    .eq('roadmap_id', roadmapId);

  if (phasesLookupError) throw phasesLookupError;

  const phasesByName = new Map(
    (existingPhases ?? []).map((p) => [String(p.name).toLowerCase(), p.id as number]),
  );

  for (let index = 0; index < params.phases.length; index += 1) {
    const phase = params.phases[index];
    const existingId = phasesByName.get(phase.name.toLowerCase());
    if (existingId) {
      phaseIdsByIndex.set(index, existingId);
      continue;
    }

    const { data: created, error } = await supabase
      .from('phase_roadmap')
      .insert({
        roadmap_id: roadmapId,
        name: phase.name,
        description: phase.description ?? null,
        init_at: addDaysDateOnly(params.appliedAt, phase.startOffsetDays),
        end_at: addDaysDateOnly(params.appliedAt, phase.endOffsetDays),
      })
      .select('id')
      .single();

    if (error) throw error;
    phaseIdsByIndex.set(index, created.id as number);
    phasesByName.set(phase.name.toLowerCase(), created.id as number);
  }

  return phaseIdsByIndex;
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
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('template_id')
    .eq('id', projectId)
    .maybeSingle();

  // If the column exists and is set, trust it. Ignore lookup errors so older DBs
  // without the migration still fall back to channels / audit.
  if (!projectError && isProjectTemplateId(project?.template_id)) {
    return project.template_id;
  }

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
