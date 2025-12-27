'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/models';
import { Card } from '@/components/ui/Card';

interface KanbanTaskProps {
  task: Task;
  onEdit?: () => void;
}

export const KanbanTask: React.FC<KanbanTaskProps> = ({ task, onEdit }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onEdit}
      className="cursor-pointer touch-none"
    >
      <Card className="p-3 bg-[var(--bg-primary)] hover:border-[var(--accent-primary)] transition-colors border border-[var(--border-color)]">
        <h4 className="font-medium text-[var(--text-primary)] mb-2">{task.title}</h4>
        {task.description && (
          <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
            {task.description}
          </p>
        )}

        <div className="flex justify-end items-center mt-2">
          <div className="flex -space-x-2">
            {task.assignments?.map((assignment) => (
              <div
                key={assignment.user_id}
                className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center text-xs border-2 border-[var(--bg-primary)]"
                title={assignment.user?.name}
              >
                {assignment.user?.name?.[0] || '?'}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
