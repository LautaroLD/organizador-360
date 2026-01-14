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
import { Plus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import useGemini from '@/hooks/useGemini';
import SuggestionsModal from './SuggestionsModal';

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
  const { generateSuggestedTasks } = useGemini();
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
        console.log(data);
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
          <Button variant='ghost' className='text-[var(--accent-primary)]' onClick={() => generateSuggestions.mutate()} disabled={generateSuggestions.isPending}>
            <p className='hidden md:flex md:mr-2'>
              {generateSuggestions.isPending ? 'Generando...' : 'Sugerir tareas con IA'}
            </p>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M10.6144 17.7956 11.492 15.7854C12.2731 13.9966 13.6789 12.5726 15.4325 11.7942L17.8482 10.7219C18.6162 10.381 18.6162 9.26368 17.8482 8.92277L15.5079 7.88394C13.7092 7.08552 12.2782 5.60881 11.5105 3.75894L10.6215 1.61673C10.2916.821765 9.19319.821767 8.8633 1.61673L7.97427 3.75892C7.20657 5.60881 5.77553 7.08552 3.97685 7.88394L1.63658 8.92277C.868537 9.26368.868536 10.381 1.63658 10.7219L4.0523 11.7942C5.80589 12.5726 7.21171 13.9966 7.99275 15.7854L8.8704 17.7956C9.20776 18.5682 10.277 18.5682 10.6144 17.7956ZM19.4014 22.6899 19.6482 22.1242C20.0882 21.1156 20.8807 20.3125 21.8695 19.8732L22.6299 19.5353C23.0412 19.3526 23.0412 18.7549 22.6299 18.5722L21.9121 18.2532C20.8978 17.8026 20.0911 16.9698 19.6586 15.9269L19.4052 15.3156C19.2285 14.8896 18.6395 14.8896 18.4628 15.3156L18.2094 15.9269C17.777 16.9698 16.9703 17.8026 15.956 18.2532L15.2381 18.5722C14.8269 18.7549 14.8269 19.3526 15.2381 19.5353L15.9985 19.8732C16.9874 20.3125 17.7798 21.1156 18.2198 22.1242L18.4667 22.6899C18.6473 23.104 19.2207 23.104 19.4014 22.6899Z"></path></svg>
          </Button>
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
