'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanTask } from './KanbanTask';
import { Task } from '@/models';

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  onEditTask?: (task: Task) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, tasks, onEditTask }) => {
  const { setNodeRef } = useDroppable({
    id: id,
  });

  return (
    <div id={id} className="flex flex-col w-80 md:w-96 bg-[var(--bg-secondary)] rounded-lg p-2 min-h-full max-h-full flex-shrink-0 overflow-y-auto" >
      <h3 className="font-semibold text-[var(--text-primary)] m-4 flex justify-between items-center flex-none">
        {title}
        <span className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs px-2 py-1 rounded-full">
          {tasks.length}
        </span>
      </h3>

      <div ref={setNodeRef} className="flex-1 p-2 overflow-y-auto space-y-3 min-h-[100px]">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanTask key={task.id} task={task} onEdit={() => onEditTask?.(task)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};
