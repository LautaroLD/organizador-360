'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanTask } from './KanbanTask';
import { TaskModal } from './TaskModal';
import { useTasks } from '@/hooks/useTasks';
import { Button } from '@/components/ui/Button';
import { Plus, Sparkles, Lock, CheckCircleIcon, ClockIcon } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import useGemini from '@/hooks/useGemini';
import SuggestionsModal from './SuggestionsModal';
import { createClient } from '@/lib/supabase/client';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';
import CreateRoadmap from './CreateRoadmap';
import { RoadmapPhase } from '@/models';

interface KanbanBoardProps {
  projectId: string;
}

type RoadmapPhaseOption = Pick<RoadmapPhase, 'id' | 'name' | 'init_at' | 'end_at' | 'description'>;

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
  const { generateSuggestedTasks } = useGemini();
  const supabase = createClient();

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

  const editingTask = React.useMemo(() =>
    tasks?.find(t => t.id === editingTaskId) || null
    , [tasks, editingTaskId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredTasks = React.useMemo(() => {
    if (!tasks) {
      return [];
    }

    if (selectedPhaseId === 'all') {
      return tasks;
    }

    if (selectedPhaseId === 'none') {
      return tasks.filter((task) => !task.phase_roadmap_id);
    }

    return tasks.filter((task) => task.phase_roadmap_id === selectedPhaseId);
  }, [selectedPhaseId, tasks]);

  const columns = {
    todo: filteredTasks.filter((task) => task.status === 'todo'),
    'in-progress': filteredTasks.filter((task) => task.status === 'in-progress'),
    done: filteredTasks.filter((task) => task.status === 'done'),
  };

  const phaseStats = React.useMemo(() => {
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

  const phaseLabels = React.useMemo(() => {
    return roadmapPhases.reduce<Record<number, string>>((acc, phase) => {
      acc[phase.id] = phase.name;
      return acc;
    }, {});
  }, [roadmapPhases]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDragOver = (_event: DragOverEvent) => {
    // Optional: Add logic for visual feedback during drag
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeTask = tasks?.find(t => t.id === active.id);
    const overId = over.id as string;

    if (activeTask) {
      let newStatus = activeTask.status;

      // If dropped over a column
      if (overId === 'todo' || overId === 'in-progress' || overId === 'done') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newStatus = overId as any;
      } else {
        // If dropped over another task
        const overTask = tasks?.find(t => t.id === overId);
        if (overTask) {
          newStatus = overTask.status;
        }
      }

      if (activeTask.status !== newStatus) {
        updateTask.mutate({
          id: activeTask.id,
          data: { status: newStatus }
        });
      }
    }

    setActiveId(null);
  };

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
      mutationFn: async () => await generateSuggestedTasks({ currentTasks: columns }),
      onSuccess: (data) => {
        setSuggestions(JSON.parse(data));
      },
      onError: (error) => {
        console.error('Error generating suggestions:', error);
        alert('Error al generar sugerencias. Por favor, intenta de nuevo más tarde.');
      }
    });
  return (
    <div className="min-h-full flex flex-col overflow-hidden w-full">
      <div className="flex-none flex justify-between items-center mb-4 p-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Tablero Kanban</h2>
          {roadmapPhases.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-[var(--text-secondary)]">Filtrar por fase:</label>
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
                className="text-xs bg-[var(--bg-primary)] border border-[var(--text-secondary)]/30 rounded-md px-2 py-1 text-[var(--text-primary)]"
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
          )}
        </div>
        <div className='flex gap-3 items-center mb-auto'>
          <div className="relative group">
            <Button
              size='sm'
              variant='ghost'
              className='text-[var(--accent-primary)]'
              onClick={() => generateSuggestions.mutate()}
              disabled={generateSuggestions.isPending || !isPremium}
              title={!isPremium ? 'Función disponible solo en Plan Pro o Enterprise' : ''}
            >
              <p className='hidden md:flex md:mr-2'>
                {generateSuggestions.isPending ? 'Generando...' : 'Sugerir tareas con IA'}
              </p>
              {<Sparkles size={20} />}
            </Button>
            {!isPremium && (
              <div className="absolute hidden group-hover:block z-10 w-48 p-2 mt-1 right-0 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md shadow-lg text-xs text-[var(--text-secondary)]">
                <p>Función disponible solo en Plan Pro o Enterprise</p>
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

      {phaseStats.length > 0 && (
        <div className="px-4 mb-4">
          <div className="grid grid-cols-3 gap-3">
            {phaseStats.map((phase) => (
              <div key={phase.id} className="p-3 rounded-md border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)]">
                <div className="flex items-center flex-wrap justify-between mb-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{phase.name}</p>
                  <span className="text-xs text-[var(--text-secondary)]">{phase.percent}%</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent-primary)] transition-all"
                    style={{ width: `${phase.percent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span className='flex gap-1 items-center'><CheckCircleIcon size={13} /> {phase.doneCount}</span>
                  <span className='flex gap-1 items-center'><ClockIcon size={13} /> {phase.pendingCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-5 overflow-x-auto  overflow-y-hidden p-4 min-h-0 h-full">
          <KanbanColumn
            id="todo"
            title="Por hacer"
            tasks={columns.todo}
            phaseLabels={phaseLabels}
            onEditTask={(task) => { setEditingTaskId(task.id); setIsModalOpen(true); }}
          />
          <KanbanColumn
            id="in-progress"
            title="En progreso"
            tasks={columns['in-progress']}
            phaseLabels={phaseLabels}
            onEditTask={(task) => { setEditingTaskId(task.id); setIsModalOpen(true); }}
          />
          <KanbanColumn
            id="done"
            title="Completado"
            tasks={columns.done}
            phaseLabels={phaseLabels}
            onEditTask={(task) => { setEditingTaskId(task.id); setIsModalOpen(true); }}
          />
        </div>

        <DragOverlay>
          {activeId && tasks?.find((t) => t.id === activeId) ? (
            <KanbanTask task={tasks.find((t) => t.id === activeId)!} />
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
