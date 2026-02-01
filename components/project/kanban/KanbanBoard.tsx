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
import { Plus, Sparkles, Lock } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import useGemini from '@/hooks/useGemini';
import SuggestionsModal from './SuggestionsModal';
import { createClient } from '@/lib/supabase/client';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';

interface KanbanBoardProps {
  projectId: string;
}

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

  const columns = {
    todo: tasks?.filter((task) => task.status === 'todo') || [],
    'in-progress': tasks?.filter((task) => task.status === 'in-progress') || [],
    done: tasks?.filter((task) => task.status === 'done') || [],
  };

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
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Tablero Kanban</h2>
        <div className='flex gap-3 items-center'>
          <div className="relative group">
            <Button
              variant='ghost'
              className='text-[var(--accent-primary)]'
              onClick={() => generateSuggestions.mutate()}
              disabled={generateSuggestions.isPending || !isPremium}
              title={!isPremium ? 'Función disponible solo en Plan Pro o Enterprise' : ''}
            >
              <p className='hidden md:flex md:mr-2'>
                {generateSuggestions.isPending ? 'Generando...' : 'Sugerir tareas con IA'}
              </p>
              {!isPremium ? <Lock size={20} /> : <Sparkles size={20} />}
            </Button>
            {!isPremium && (
              <div className="absolute hidden group-hover:block z-10 w-48 p-2 mt-1 right-0 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md shadow-lg text-xs text-[var(--text-secondary)]">
                <p>Función disponible solo en Plan Pro o Enterprise</p>
              </div>
            )}
          </div>
          <Button onClick={() => { setEditingTaskId(null); setIsModalOpen(true); }}>
            <Plus size={24} />
            <p className='hidden md:flex md:ml-2'>
              Nueva Tarea
            </p>
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-5 overflow-x-auto  overflow-y-hidden p-4 min-h-0 h-full">
          <KanbanColumn id="todo" title="Por hacer" tasks={columns.todo} onEditTask={(task) => { setEditingTaskId(task.id); setIsModalOpen(true); }} />
          <KanbanColumn id="in-progress" title="En progreso" tasks={columns['in-progress']} onEditTask={(task) => { setEditingTaskId(task.id); setIsModalOpen(true); }} />
          <KanbanColumn id="done" title="Completado" tasks={columns.done} onEditTask={(task) => { setEditingTaskId(task.id); setIsModalOpen(true); }} />
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
