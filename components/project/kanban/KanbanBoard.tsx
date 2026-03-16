'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanTaskCard } from './KanbanTask';
import { TaskModal } from './TaskModal';
import { useTasks } from '@/hooks/useTasks';
import { Button } from '@/components/ui/Button';
import { Plus, Sparkles, CheckCircleIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon, ListTodo, CircleDashed, CircleCheckBig } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import useGemini from '@/hooks/useGemini';
import SuggestionsModal from './SuggestionsModal';
import { createClient } from '@/lib/supabase/client';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';
import CreateRoadmap from './CreateRoadmap';
import { Epic, RoadmapPhase, Task } from '@/models';

interface KanbanBoardProps {
  projectId: string;
}

type RoadmapPhaseOption = Pick<RoadmapPhase, 'id' | 'name' | 'init_at' | 'end_at' | 'description'>;
type EpicOption = Pick<Epic, 'id' | 'title'>;

const parseAISuggestions = (payload: unknown): string[] => {
  const toStringArray = (candidate: unknown): string[] => {
    if (!Array.isArray(candidate)) {
      return [];
    }

    return candidate
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && 'title' in item && typeof item.title === 'string') {
          return item.title.trim();
        }
        return '';
      })
      .filter((item) => item.length > 0);
  };

  if (Array.isArray(payload)) {
    return toStringArray(payload);
  }

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return [];

    try {
      return toStringArray(JSON.parse(trimmed));
    } catch {
      const embedded = trimmed.match(/\[[\s\S]*\]/)?.[0];
      if (embedded) {
        try {
          return toStringArray(JSON.parse(embedded));
        } catch {
          return [];
        }
      }
      return [];
    }
  }

  return [];
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId }) => {
  const {
    tasks,
    updateTask,
    createTask,
    deleteTask,
  } = useTasks(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<'all' | 'none' | number>('all');
  const [selectedEpicId, setSelectedEpicId] = useState<'all' | 'none' | string>('all');
  const [dragTasks, setDragTasks] = useState<Task[] | null>(null);
  const { generateSuggestedTasks } = useGemini();
  const supabase = createClient();
  const [openPhaseStats, setOpenPhaseStats] = useState(false);
  // Verificar si el usuario puede usar IA
  React.useEffect(() => {
    const checkPremium = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const allowed = await canUseAIFeatures(supabase, user.id);
        setIsPremium(allowed);
      }
    };
    checkPremium();
  }, [supabase]);

  const { data: roadmapPhases = [] } = useQuery({
    queryKey: ['roadmap-phases', projectId],
    queryFn: async () => {
      const { data: roadmap, error: roadmapError } = await supabase
        .from('roadmap')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();

      if (roadmapError) throw roadmapError;
      if (!roadmap) return [] as RoadmapPhaseOption[];

      const { data, error } = await supabase
        .from('phase_roadmap')
        .select('id, name, init_at, end_at, description')
        .eq('roadmap_id', roadmap.id)
        .order('id');

      if (error) throw error;
      return (data || []) as RoadmapPhaseOption[];
    },
    enabled: !!projectId,
  });

  const { data: epics = [] } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('epics')
        .select('id, title')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as EpicOption[];
    },
    enabled: !!projectId,
  });

  const editingTask = useMemo(() =>
    tasks?.find(t => t.id === editingTaskId) || null
    , [tasks, editingTaskId]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        // Allow vertical scroll gestures before starting drag on mobile.
        delay: 180,
        tolerance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const boardTasks = useMemo(() => dragTasks ?? tasks ?? [], [dragTasks, tasks]);

  const filteredTasks = useMemo(() => {
    return boardTasks.filter((task) => {
      const phaseMatches =
        selectedPhaseId === 'all'
          ? true
          : selectedPhaseId === 'none'
            ? !task.phase_roadmap_id
            : task.phase_roadmap_id === selectedPhaseId;

      if (!phaseMatches) {
        return false;
      }

      if (selectedEpicId === 'all') {
        return true;
      }

      if (selectedEpicId === 'none') {
        return !task.epic_id;
      }

      return task.epic_id === selectedEpicId;
    });
  }, [boardTasks, selectedEpicId, selectedPhaseId]);

  const columns = useMemo(
    () => filteredTasks.reduce<Record<Task['status'], Task[]>>((acc, task) => {
      acc[task.status].push(task);
      return acc;
    }, {
      todo: [],
      'in-progress': [],
      done: [],
    }),
    [filteredTasks]
  );

  const allProjectColumns = useMemo(
    () => (tasks || []).reduce<Record<Task['status'], Task[]>>((acc, task) => {
      acc[task.status].push(task);
      return acc;
    }, {
      todo: [],
      'in-progress': [],
      done: [],
    }),
    [tasks]
  );

  const tasksById = useMemo(() => {
    return (boardTasks || []).reduce<Record<string, Task>>((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {});
  }, [boardTasks]);

  const persistedTasksById = useMemo(() => {
    return (tasks || []).reduce<Record<string, Task>>((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {});
  }, [tasks]);

  const phaseStats = useMemo(() => {
    const allTasks = tasks || [];

    const stats = roadmapPhases.map((phase) => {
      const phaseTasks = allTasks.filter((task) => task.phase_roadmap_id === phase.id);
      const doneCount = phaseTasks.filter((task) => task.status === 'done').length;
      const totalCount = phaseTasks.length;
      const pendingCount = totalCount - doneCount;
      const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

      return {
        id: phase.id,
        name: phase.name,
        doneCount,
        pendingCount,
        totalCount,
        percent,
      };
    });

    const unassignedTasks = allTasks.filter((task) => !task.phase_roadmap_id);
    if (unassignedTasks.length > 0) {
      const doneCount = unassignedTasks.filter((task) => task.status === 'done').length;
      const totalCount = unassignedTasks.length;
      stats.push({
        id: -1,
        name: 'Sin fase',
        doneCount,
        pendingCount: totalCount - doneCount,
        totalCount,
        percent: totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100),
      });
    }

    return stats;
  }, [roadmapPhases, tasks]);

  const phaseLabels = useMemo(() => {
    return roadmapPhases.reduce<Record<number, string>>((acc, phase) => {
      acc[phase.id] = phase.name;
      return acc;
    }, {});
  }, [roadmapPhases]);

  const epicLabels = useMemo(() => {
    return epics.reduce<Record<string, string>>((acc, epic) => {
      acc[epic.id] = epic.title;
      return acc;
    }, {});
  }, [epics]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDragTasks(tasks || []);
  }, [tasks]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    setDragTasks((prev) => {
      if (!prev) {
        return prev;
      }

      const activeTask = prev.find((task) => task.id === activeId);
      if (!activeTask) {
        return prev;
      }

      let nextStatus: Task['status'] | null = null;

      if (overId === 'todo' || overId === 'in-progress' || overId === 'done') {
        nextStatus = overId;
      } else {
        const overTask = prev.find((task) => task.id === overId);
        if (overTask) {
          nextStatus = overTask.status;
        }
      }

      if (!nextStatus || nextStatus === activeTask.status) {
        return prev;
      }

      return prev.map((task) =>
        task.id === activeTask.id
          ? { ...task, status: nextStatus }
          : task
      );
    });
  }, []);

  const handleDragCancel = useCallback(() => {
    setDragTasks(null);
    setActiveId(null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setDragTasks(null);
      setActiveId(null);
      return;
    }

    const currentTasks = dragTasks ?? tasks ?? [];
    const currentTasksById = currentTasks.reduce<Record<string, Task>>((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {});

    const activeTask = currentTasksById[active.id as string];
    const persistedTask = persistedTasksById[active.id as string];
    const overId = over.id as string;

    if (activeTask) {
      let newStatus: Task['status'] = activeTask.status;

      // If dropped over a column
      if (overId === 'todo' || overId === 'in-progress' || overId === 'done') {
        newStatus = overId;
      } else {
        // If dropped over another task
        const overTask = currentTasksById[overId];
        if (overTask) {
          newStatus = overTask.status;
        }
      }

      if (persistedTask && persistedTask.status !== newStatus) {
        updateTask.mutate({
          id: activeTask.id,
          data: { status: newStatus }
        });
      }
    }

    setDragTasks(null);
    setActiveId(null);
  }, [dragTasks, persistedTasksById, tasks, updateTask]);

  const activeTask = activeId ? tasksById[activeId] : null;

  const handleEditTask = useCallback((task: Task) => {
    setEditingTaskId(task.id);
    setIsModalOpen(true);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCreateTask = (data: any) => {
    createTask.mutate({ ...data, project_id: projectId });
    setIsModalOpen(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUpdateTask = (id: string, data: any) => {
    updateTask.mutate({ id, data });
    setIsModalOpen(false);
    setEditingTaskId(null);
  };

  const handleDeleteTask = (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
      deleteTask.mutate(id);
      setIsModalOpen(false);
      setEditingTaskId(null);
    }
  };
  const generateSuggestions = useMutation(
    {
      mutationFn: async () => await generateSuggestedTasks({
        currentTasks: {
          columns: allProjectColumns,
          phaseLabels,
          epicLabels,
          filters: {
            selectedPhaseId,
            selectedEpicId,
          },
        }
      }),
      onSuccess: (data) => {
        const parsedSuggestions = parseAISuggestions(data);
        setSuggestions(parsedSuggestions);

        if (parsedSuggestions.length === 0) {
          alert('No se pudieron generar sugerencias accionables con el estado actual del proyecto.');
        }
      },
      onError: (error) => {
        console.error('Error generating suggestions:', error);
        alert('Error al generar sugerencias. Por favor, intenta de nuevo más tarde.');
      }
    });

  const boardOverview = useMemo(() => {
    const visibleTotal = filteredTasks.length;
    const visibleDone = columns.done.length;
    const visibleInProgress = columns['in-progress'].length;
    const visibleTodo = columns.todo.length;
    const overdue = filteredTasks.filter((task) => {
      if (!task.done_estimated_at || task.status === 'done') {
        return false;
      }

      const ts = Date.parse(task.done_estimated_at);
      // eslint-disable-next-line react-hooks/purity
      return Number.isFinite(ts) && ts < Date.now();
    }).length;

    const progress = visibleTotal > 0 ? Math.round((visibleDone / visibleTotal) * 100) : 0;

    return {
      visibleTotal,
      visibleDone,
      visibleInProgress,
      visibleTodo,
      overdue,
      progress,
    };
  }, [columns.done.length, columns.todo.length, columns, filteredTasks]);

  return (
    <div className="min-h-full flex flex-col overflow-hidden w-full">
      <div className="flex-none p-4 border-b border-[var(--text-secondary)]/15 bg-gradient-to-r from-[var(--bg-secondary)] to-[var(--bg-primary)]">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Tablero Kanban</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Gestiona tareas por estado, foco y prioridad en una sola vista.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                <ListTodo className="w-3 h-3" /> {boardOverview.visibleTotal} visibles
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                <CircleCheckBig className="w-3 h-3 text-emerald-600" /> {boardOverview.progress}% completado
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                <CircleDashed className="w-3 h-3 text-amber-600" /> {boardOverview.visibleInProgress} en progreso
              </span>
              {boardOverview.overdue > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-red-500/30 bg-red-500/10 text-red-700">
                  <ClockIcon className="w-3 h-3" /> {boardOverview.overdue} vencidas
                </span>
              )}
            </div>

            {(roadmapPhases.length > 0 || epics.length > 0) && (
              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-secondary)]">Filtrar por fase</label>
                  <select
                    value={selectedPhaseId}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === 'all' || value === 'none') {
                        setSelectedPhaseId(value);
                        return;
                      }
                      setSelectedPhaseId(Number(value));
                    }}
                    className="text-xs bg-[var(--bg-primary)] border border-[var(--text-secondary)]/30 rounded-md px-2.5 py-1.5 text-[var(--text-primary)] min-w-[150px]"
                  >
                    <option value="all">Todas</option>
                    {roadmapPhases.map((phase) => (
                      <option key={phase.id} value={phase.id}>
                        {phase.name}
                      </option>
                    ))}
                    <option value="none">Sin fase</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-secondary)]">Filtrar por epica</label>
                  <select
                    value={selectedEpicId}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === 'all' || value === 'none') {
                        setSelectedEpicId(value);
                        return;
                      }
                      setSelectedEpicId(value);
                    }}
                    className="text-xs bg-[var(--bg-primary)] border border-[var(--text-secondary)]/30 rounded-md px-2.5 py-1.5 text-[var(--text-primary)] min-w-[150px]"
                  >
                    <option value="all">Todas</option>
                    {epics.map((epic) => (
                      <option key={epic.id} value={epic.id}>
                        {epic.title}
                      </option>
                    ))}
                    <option value="none">Sin epica</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className='flex gap-2.5 items-center md:self-start'>
            <div className="relative group">
              <Button
                size='sm'
                variant='outline'
                className='text-[var(--accent-primary)] border-[var(--accent-primary)]/30 bg-[var(--bg-primary)]'
                onClick={() => generateSuggestions.mutate()}
                disabled={generateSuggestions.isPending || !isPremium}
                title={!isPremium ? 'Función disponible solo en Plan Pro' : ''}
              >
                <p className='hidden md:flex md:mr-2'>
                  {generateSuggestions.isPending ? 'Generando...' : 'Sugerir tareas con IA'}
                </p>
                {<Sparkles size={20} className={generateSuggestions.isPending ? 'animate-pulse' : ''} />}
              </Button>
              {!isPremium && (
                <div className="absolute hidden group-hover:block z-10 w-48 p-2 mt-1 right-0 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md shadow-lg text-xs text-[var(--text-secondary)]">
                  <p>Función disponible solo en Plan Pro</p>
                </div>
              )}
            </div>
            <Button size='sm' onClick={() => { setEditingTaskId(null); setIsModalOpen(true); }}>
              <Plus size={20} />
              <p className='hidden md:flex md:ml-1'>
                Nueva Tarea
              </p>
            </Button>
            <CreateRoadmap projectId={projectId} />
          </div>
        </div>
      </div>

      {phaseStats.length > 0 && (
        <div className="px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--text-secondary)]/10">
          <div hidden={!openPhaseStats} className="flex flex-nowrap overflow-x-auto py-1 gap-3">
            {phaseStats.map((phase) => (
              <div key={phase.id} className="min-w-[210px] max-w-[210px] px-2.5 py-2 rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] flex flex-col gap-1.5">
                <div className="flex items-center flex-wrap justify-between">
                  <p className="text-sm font-medium text-[var(--text-primary)] text-ellipsis overflow-hidden whitespace-nowrap">{phase.name}</p>
                  <span className="text-xs text-[var(--text-secondary)]">{phase.percent}%</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent-primary)] transition-all"
                    style={{ width: `${phase.percent}%` }}
                  />
                </div>
                <div className="flex items-center h-auto mt-auto justify-between text-xs text-[var(--text-secondary)]">
                  <span className='flex gap-1 items-center'><CheckCircleIcon size={13} /> {phase.doneCount}</span>
                  <span className='flex gap-1 items-center'><ClockIcon size={13} /> {phase.pendingCount}</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setOpenPhaseStats(!openPhaseStats)}
            className="mx-auto flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            type="button"
          >
            {openPhaseStats ? 'Ocultar avance por fase' : 'Ver avance por fase'}
            {openPhaseStats ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-4 overflow-x-auto overflow-y-hidden p-4 min-h-0 h-full bg-[var(--bg-primary)]">
          <KanbanColumn
            id="todo"
            title="Por hacer"
            tasks={columns.todo}
            phaseLabels={phaseLabels}
            epicLabels={epicLabels}
            onEditTask={handleEditTask}
          />
          <KanbanColumn
            id="in-progress"
            title="En progreso"
            tasks={columns['in-progress']}
            phaseLabels={phaseLabels}
            epicLabels={epicLabels}
            onEditTask={handleEditTask}
          />
          <KanbanColumn
            id="done"
            title="Completado"
            tasks={columns.done}
            phaseLabels={phaseLabels}
            epicLabels={epicLabels}
            onEditTask={handleEditTask}
          />
        </div>

        <DragOverlay>
          {activeTask ? (
            <KanbanTaskCard
              task={activeTask}
              phaseLabel={activeTask.phase_roadmap_id ? phaseLabels[activeTask.phase_roadmap_id] : null}
              epicLabel={activeTask.epic_id ? epicLabels[activeTask.epic_id] : null}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      {suggestions.length > 0 && (
        <SuggestionsModal addTask={handleCreateTask} suggestions={suggestions} onClose={() => setSuggestions([])} />
      )}
      {isModalOpen && (
        <TaskModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingTaskId(null); }}
          onSubmit={editingTask ? (data) => handleUpdateTask(editingTask.id, data) : handleCreateTask}
          onDelete={editingTask ? () => handleDeleteTask(editingTask.id) : undefined}
          initialData={editingTask}
          projectId={projectId}
        />
      )}
    </div>
  );
};
