import { ai } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';

type TaskStatus = 'todo' | 'in-progress' | 'done';
type TaskPriority = 'alta' | 'media' | 'baja' | null;

interface TaskSnapshot {
  id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  phase_roadmap_id?: number | null;
  epic_id?: string | null;
  done_estimated_at?: string | null;
}

interface SuggestionPayload {
  columns?: Partial<Record<TaskStatus, unknown[]>>;
  phaseLabels?: Record<string, string>;
  epicLabels?: Record<string, string>;
  filters?: {
    selectedPhaseId?: 'all' | 'none' | number;
    selectedEpicId?: 'all' | 'none' | string;
  };
}

const STATUS_KEYS: TaskStatus[] = ['todo', 'in-progress', 'done'];

const cleanText = (value: string) => value.replace(/\s+/g, ' ').trim();

const normalizeForComparison = (value: string) =>
  cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '');

const normalizeStatus = (value: unknown, fallback: TaskStatus): TaskStatus => {
  if (value === 'todo' || value === 'in-progress' || value === 'done') {
    return value;
  }
  return fallback;
};

const normalizePriority = (value: unknown): TaskPriority => {
  if (value === 'alta' || value === 'media' || value === 'baja') {
    return value;
  }
  return null;
};

const parseTask = (raw: unknown, fallbackStatus: TaskStatus): TaskSnapshot | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const task = raw as Record<string, unknown>;
  const title = typeof task.title === 'string' ? cleanText(task.title) : '';

  if (!title) {
    return null;
  }

  return {
    id: typeof task.id === 'string' ? task.id : undefined,
    title,
    description: typeof task.description === 'string' ? cleanText(task.description).slice(0, 200) : undefined,
    status: normalizeStatus(task.status, fallbackStatus),
    priority: normalizePriority(task.priority),
    phase_roadmap_id: typeof task.phase_roadmap_id === 'number' ? task.phase_roadmap_id : null,
    epic_id: typeof task.epic_id === 'string' ? task.epic_id : null,
    done_estimated_at: typeof task.done_estimated_at === 'string' ? task.done_estimated_at : null,
  };
};

const extractPayload = (raw: unknown): SuggestionPayload => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const payload = raw as SuggestionPayload & Partial<Record<TaskStatus, unknown[]>>;

  // Backward compatibility: allow directly passing {todo, in-progress, done}
  if (!payload.columns) {
    const hasLegacyShape = STATUS_KEYS.some((status) => Array.isArray(payload[status]));
    if (hasLegacyShape) {
      return {
        columns: {
          todo: Array.isArray(payload.todo) ? payload.todo : [],
          'in-progress': Array.isArray(payload['in-progress']) ? payload['in-progress'] : [],
          done: Array.isArray(payload.done) ? payload.done : [],
        },
      };
    }
  }

  return payload;
};

const collectTasksByStatus = (payload: SuggestionPayload): Record<TaskStatus, TaskSnapshot[]> => {
  const source = payload.columns || {};

  return STATUS_KEYS.reduce<Record<TaskStatus, TaskSnapshot[]>>((acc, status) => {
    const rawTasks = Array.isArray(source[status]) ? source[status] : [];
    acc[status] = rawTasks
      .map((task) => parseTask(task, status))
      .filter((task): task is TaskSnapshot => Boolean(task));
    return acc;
  }, {
    todo: [],
    'in-progress': [],
    done: [],
  });
};

const buildProjectStateSummary = (tasksByStatus: Record<TaskStatus, TaskSnapshot[]>, payload: SuggestionPayload) => {
  const allTasks = [...tasksByStatus.todo, ...tasksByStatus['in-progress'], ...tasksByStatus.done];
  const total = allTasks.length;
  const donePct = total > 0 ? Math.round((tasksByStatus.done.length / total) * 100) : 0;

  const now = Date.now();
  const overdue = allTasks
    .filter((task) => task.status !== 'done' && task.done_estimated_at)
    .filter((task) => {
      if (!task.done_estimated_at) {
        return false;
      }
      const ts = Date.parse(task.done_estimated_at);
      return Number.isFinite(ts) && ts < now;
    });

  const priorities = {
    alta: allTasks.filter((task) => task.priority === 'alta' && task.status !== 'done').length,
    media: allTasks.filter((task) => task.priority === 'media' && task.status !== 'done').length,
    baja: allTasks.filter((task) => task.priority === 'baja' && task.status !== 'done').length,
  };

  const bottlenecks: string[] = [];
  if (tasksByStatus.todo.length >= Math.max(4, tasksByStatus['in-progress'].length * 2)) {
    bottlenecks.push('Backlog alto respecto a tareas en progreso');
  }
  if (tasksByStatus['in-progress'].length > tasksByStatus.todo.length + 2) {
    bottlenecks.push('Demasiadas tareas en progreso en paralelo');
  }
  if (overdue.length > 0) {
    bottlenecks.push(`Hay ${overdue.length} tareas vencidas pendientes`);
  }
  if (priorities.alta > 0 && tasksByStatus['in-progress'].length === 0) {
    bottlenecks.push('Hay tareas de alta prioridad sin ejecución activa');
  }

  const phaseCounts: Record<string, number> = {};
  const epicCounts: Record<string, number> = {};
  for (const task of allTasks) {
    if (typeof task.phase_roadmap_id === 'number') {
      const phaseName = payload.phaseLabels?.[String(task.phase_roadmap_id)] || `Fase ${task.phase_roadmap_id}`;
      phaseCounts[phaseName] = (phaseCounts[phaseName] || 0) + 1;
    }
    if (task.epic_id) {
      const epicName = payload.epicLabels?.[task.epic_id] || 'Epic sin nombre';
      epicCounts[epicName] = (epicCounts[epicName] || 0) + 1;
    }
  }

  const topTodo = tasksByStatus.todo.slice(0, 12).map((task) => task.title);
  const topInProgress = tasksByStatus['in-progress'].slice(0, 12).map((task) => task.title);
  const topDone = tasksByStatus.done.slice(0, 8).map((task) => task.title);

  return {
    totals: {
      total,
      todo: tasksByStatus.todo.length,
      inProgress: tasksByStatus['in-progress'].length,
      done: tasksByStatus.done.length,
      donePct,
    },
    priorities,
    overdueCount: overdue.length,
    bottlenecks,
    topTodo,
    topInProgress,
    topDone,
    phaseDistribution: phaseCounts,
    epicDistribution: epicCounts,
    activeFilters: payload.filters || { selectedPhaseId: 'all', selectedEpicId: 'all' },
  };
};

const parseSuggestionsText = (rawText: string): string[] => {
  const text = rawText.trim();
  if (!text) return [];

  const parseArray = (candidate: string): string[] | null => {
    try {
      const parsed = JSON.parse(candidate);
      if (!Array.isArray(parsed)) {
        return null;
      }

      return parsed
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'title' in item && typeof item.title === 'string') {
            return item.title;
          }
          return null;
        })
        .filter((item): item is string => Boolean(item));
    } catch {
      return null;
    }
  };

  const direct = parseArray(text);
  if (direct) return direct;

  const fenced = text.match(/\[[\s\S]*\]/);
  if (fenced?.[0]) {
    const parsed = parseArray(fenced[0]);
    if (parsed) return parsed;
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean);
};

const cleanAndDeduplicateSuggestions = (rawSuggestions: string[], existingTitles: Set<string>) => {
  const seen = new Set<string>();
  const finalSuggestions: string[] = [];

  for (const raw of rawSuggestions) {
    const cleaned = cleanText(raw).replace(/^"|"$/g, '');
    if (!cleaned) continue;

    const normalized = normalizeForComparison(cleaned);
    if (!normalized || normalized.length < 6) continue;

    if (existingTitles.has(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    finalSuggestions.push(cleaned.slice(0, 120));

    if (finalSuggestions.length >= 5) {
      break;
    }
  }

  return finalSuggestions;
};

export async function POST(req: NextRequest) {
  try {
    // Verificar que el usuario esté autenticado
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar que el usuario sea premium
    const canUseAI = await canUseAIFeatures(supabase, user.id);
    if (!canUseAI) {
      return NextResponse.json(
        { error: 'Esta función está disponible solo para plan Pro' },
        { status: 403 }
      );
    }

    const { project, currentTasks } = await req.json();
    const suggestionPayload = extractPayload(currentTasks);
    const tasksByStatus = collectTasksByStatus(suggestionPayload);
    const allExistingTasks = [...tasksByStatus.todo, ...tasksByStatus['in-progress'], ...tasksByStatus.done];
    const existingTitles = new Set(allExistingTasks.map((task) => normalizeForComparison(task.title)));
    const projectStateSummary = buildProjectStateSummary(tasksByStatus, suggestionPayload);
    
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          text: 'Sugiere las siguientes tareas mas valiosas para el estado actual del proyecto.',
        },
        {
          text: `Proyecto: ${JSON.stringify({
            id: project?.id,
            name: project?.name,
            description: project?.description,
          })}`,
        },
        {
          text: `Estado actual del tablero: ${JSON.stringify(projectStateSummary)}`,
        },
        {
          text: 'No repitas tareas existentes ni variantes semanticas muy parecidas. Prioriza desbloqueo, riesgo y avance de hitos cercanos.',
        },
      ],
      config: {
        systemInstruction: [
          'Eres un PM tecnico senior y sugieres tareas accionables para el siguiente sprint.',
          'Debes basarte en el estado real del proyecto (backlog, progreso, prioridades, vencimientos, fases y epicas).',
          'Evita tareas genericas o abstractas sin accion concreta.',
          'Cada sugerencia debe ser un titulo concreto y ejecutable, no una categoria.',
          'Responde solo en español.',
          'Cada tarea debe ser un titulo breve (idealmente entre 5 y 12 palabras).',
          'Devuelve la respuesta en formato JSON como un array de strings.',
          'No agregues texto adicional fuera de la estructura solicitada. No uses bloques de codigo.',
          'No repitas tareas existentes, ni tareas hechas, ni duplicados entre sugerencias.',
          'Sugiere entre 3 y 5 tareas.',
        ],
      }
    });

    const suggestionsRaw = parseSuggestionsText(res.text || '');
    const suggestions = cleanAndDeduplicateSuggestions(suggestionsRaw, existingTitles);

    return NextResponse.json({ suggestions });
  } catch (error: unknown) {
    const err = error as { status?: number };
    console.error('Error fetching suggestions:', error);
    if (err.status === 429) {
      return new Response('Rate Limit Exceeded', { status: 429 });
    }
    return new Response('Internal Server Error', { status: 500 });
  }
}