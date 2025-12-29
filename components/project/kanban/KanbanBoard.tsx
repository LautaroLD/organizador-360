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
import { Task } from '@/models';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';

interface KanbanBoardProps {
  projectId: string;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId }) => {
  const {
    tasks,
    updateTask,
    createTask,
    deleteTask,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem
  } = useTasks(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

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

  const handleDragOver = (event: DragOverEvent) => {
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

  const handleCreateTask = (data: any) => {
    createTask.mutate({ ...data, project_id: projectId });
    setIsModalOpen(false);
  };

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

  return (
    <div className="min-h-full flex flex-col overflow-hidden">
      <div className="flex-none flex justify-between items-center mb-4 p-4">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Tablero Kanban</h2>
        <Button onClick={() => { setEditingTaskId(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Tarea
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-5 overflow-x-auto overflow-y-hidden p-4 min-h-0 h-full">
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

      {isModalOpen && (
        <TaskModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingTaskId(null); }}
          onSubmit={editingTask ? (data) => handleUpdateTask(editingTask.id, data) : handleCreateTask}
          onDelete={editingTask ? () => handleDeleteTask(editingTask.id) : undefined}
          initialData={editingTask}
          projectId={projectId}
          onAddChecklistItem={addChecklistItem.mutate}
          onUpdateChecklistItem={updateChecklistItem.mutate}
          onDeleteChecklistItem={deleteChecklistItem.mutate}
        />
      )}
    </div>
  );
};
