'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/models';
import { Card } from '@/components/ui/Card';
import { CheckSquare } from 'lucide-react';

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

        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.tags.map((t) => (
              <span
                key={t.id}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                style={{ backgroundColor: t.tag.color }}
              >
                {t.tag.label}
              </span>
            ))}
          </div>
        )}

        {task.description && (
          <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
            {task.description}
          </p>
        )}

        <div className="flex justify-between items-center mt-2">
          {task.checklist && task.checklist.length > 0 && (
            <div className="flex items-center text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-2 py-1 rounded">
              <CheckSquare className="w-3 h-3 mr-1" />
              <span>
                {task.checklist.filter(i => i.is_completed).length}/{task.checklist.length}
              </span>
            </div>
          )}

          <div className="flex -space-x-2 ml-auto">
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
