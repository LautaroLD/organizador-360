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
  phaseLabels?: Record<number, string>;
  epicLabels?: Record<string, string>;
  onEditTask?: (task: Task) => void;
}

const columnTheme: Record<string, { ring: string; badge: string; dot: string; }> = {
  todo: {
    ring: 'border-slate-300/70 bg-[var(--bg-secondary)]',
    badge: 'bg-slate-500/15 text-slate-600',
    dot: 'bg-slate-500',
  },
  'in-progress': {
    ring: 'border-amber-400/50 bg-[var(--bg-secondary)]',
    badge: 'bg-amber-500/15 text-amber-700',
    dot: 'bg-amber-500',
  },
  done: {
    ring: 'border-emerald-400/50 bg-[var(--bg-secondary)]',
    badge: 'bg-emerald-500/15 text-emerald-700',
    dot: 'bg-emerald-500',
  },
};

const KanbanColumnComponent: React.FC<KanbanColumnProps> = ({ id, title, tasks, phaseLabels, epicLabels, onEditTask }) => {
  const { setNodeRef } = useDroppable({
    id: id,
  });

  const sortableTaskIds = React.useMemo(() => tasks.map((task) => task.id), [tasks]);
  const theme = columnTheme[id] ?? columnTheme.todo;

  return (
    <div id={id} className={`flex flex-col w-80 md:w-96 rounded-xl border ${theme.ring} h-fit max-h-full flex-shrink-0`}>
      <h3 className="font-semibold text-[var(--text-primary)] px-4 py-3 flex justify-between items-center flex-none border-b border-[var(--text-secondary)]/10">
        <span className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
          {title}
        </span>
        <span className={`${theme.badge} text-xs px-2.5 py-1 rounded-full font-semibold`}>
          {tasks.length}
        </span>
      </h3>

      <div ref={setNodeRef} className="flex-1 p-3 overflow-y-auto space-y-2 min-h-[140px]">
        <SortableContext items={sortableTaskIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="h-24 rounded-lg border border-dashed border-[var(--text-secondary)]/25 bg-[var(--bg-primary)]/50 flex items-center justify-center text-xs text-[var(--text-secondary)] text-center px-3">
              Arrastra tareas aqui o crea una nueva para esta columna
            </div>
          ) : (
            tasks.map((task) => (
              <KanbanTask
                key={task.id}
                task={task}
                phaseLabel={task.phase_roadmap_id ? phaseLabels?.[task.phase_roadmap_id] : null}
                epicLabel={task.epic_id ? epicLabels?.[task.epic_id] : null}
                onEdit={() => onEditTask?.(task)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
};

export const KanbanColumn = React.memo(KanbanColumnComponent);
