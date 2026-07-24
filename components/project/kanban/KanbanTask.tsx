'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/models';
import { Card } from '@/components/ui/Card';
import { CheckSquare, ImageIcon, CalendarClock, Layers, Flag, FolderKanban, ClipboardCheck } from 'lucide-react';
import clsx from 'clsx';
import { formatLocalDate } from '@/lib/utils';
import type { ApprovalStatus } from '@/models/approval';

interface KanbanTaskProps {
  task: Task;
  phaseLabel?: string | null;
  epicLabel?: string | null;
  approvalStatus?: ApprovalStatus;
  onEdit?: () => void;
  isReadOnly?: boolean;
}

interface KanbanTaskCardProps {
  task: Task;
  phaseLabel?: string | null;
  epicLabel?: string | null;
  approvalStatus?: ApprovalStatus;
}

const APPROVAL_BADGE: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: {
    label: 'En revisión',
    className: 'text-amber-700 bg-amber-500/10 border-amber-500/30',
  },
  approved: {
    label: 'Aprobado',
    className: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/30',
  },
  rejected: {
    label: 'Rechazado',
    className: 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-[var(--text-secondary)]/30',
  },
  blocked: {
    label: 'Bloqueado',
    className: 'text-red-700 bg-red-500/10 border-red-500/30',
  },
};

const KanbanTaskCardComponent: React.FC<KanbanTaskCardProps> = ({
  task,
  phaseLabel,
  epicLabel,
  approvalStatus,
}) => {
  const doneEstimatedAtDate = task.done_estimated_at ? new Date(task.done_estimated_at) : null;
  const now = new Date();
  const isOverdue = doneEstimatedAtDate ? doneEstimatedAtDate.getTime() < now.getTime() : false;

  const priorityStyles: Record<'alta' | 'media' | 'baja', string> = {
    alta: 'text-red-700 bg-red-500/10 border-red-500/30',
    media: 'text-amber-700 bg-amber-500/10 border-amber-500/30',
    baja: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/30',
  };

  const approvalBadge = approvalStatus ? APPROVAL_BADGE[approvalStatus] : null;

  return (
    <Card className="p-2 bg-[var(--bg-primary)] hover:border-[var(--accent-primary)]/60 transition-all hover:shadow-sm border border-transparent flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-1.5">
        <p className="font-medium text-xs leading-snug text-[var(--text-primary)] line-clamp-2">{ task.title }</p>
        { task.priority && (
          <p className={ clsx('text-[10px] uppercase border py-0.5 px-1.5 rounded-full w-fit font-semibold shrink-0 inline-flex items-center gap-0.5', priorityStyles[task.priority]) }>
            <Flag className="w-2.5 h-2.5" />
            { task.priority }
          </p>
        ) }
      </div>

      { approvalBadge && (
        <p className={ clsx('text-[10px] border py-0.5 px-1.5 rounded-full w-fit font-medium inline-flex items-center gap-0.5', approvalBadge.className) }>
          <ClipboardCheck className="w-2.5 h-2.5" />
          { approvalBadge.label }
        </p>
      ) }

      { ((task.tags && task.tags.length > 0) || phaseLabel || epicLabel) && (
        <div className="flex flex-wrap gap-1">
          { task.tags?.slice(0, 2).map((t) => (
            <span
              key={ t.id }
              className="px-1.5 py-0.5 rounded-full text-[9px] font-medium text-white"
              style={ { backgroundColor: t.tag.color } }
            >
              { t.tag.label }
            </span>
          )) }
          { task.tags && task.tags.length > 2 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20">
              +{ task.tags.length - 2 }
            </span>
          ) }
          { phaseLabel && (
            <span className="text-[9px] text-[var(--text-secondary)] line-clamp-1 border border-[var(--text-secondary)]/20 py-0.5 px-1.5 rounded-full bg-[var(--bg-secondary)] inline-flex items-center gap-1 max-w-[9rem]">
              <Layers className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{ phaseLabel }</span>
            </span>
          ) }
          { epicLabel && (
            <span className="text-[9px] text-[var(--text-secondary)] line-clamp-1 border border-[var(--text-secondary)]/20 py-0.5 px-1.5 rounded-full bg-[var(--bg-secondary)] inline-flex items-center gap-1 max-w-[9rem]">
              <FolderKanban className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{ epicLabel }</span>
            </span>
          ) }
        </div>
      ) }

      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 min-w-0">
          { task.done_estimated_at && (
            <span className={ clsx(
              'text-[9px] border py-0.5 px-1.5 rounded-full inline-flex items-center gap-1 shrink-0',
              isOverdue
                ? 'text-red-700 border-red-500/30 bg-red-500/10'
                : 'text-[var(--text-secondary)] border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)]'
            ) }>
              <CalendarClock className="w-2.5 h-2.5" />
              { formatLocalDate(task.done_estimated_at) }
            </span>
          ) }

          { task.checklist && task.checklist.length > 0 && (
            <span className="inline-flex items-center text-[9px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/15 px-1.5 py-0.5 rounded-md">
              <CheckSquare className="w-2.5 h-2.5 mr-0.5" />
              { task.checklist.filter(i => i.is_completed).length }/{ task.checklist.length }
            </span>
          ) }

          { task.images && task.images.length > 0 && (
            <span className="inline-flex items-center text-[9px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/15 px-1.5 py-0.5 rounded-md">
              <ImageIcon className="w-2.5 h-2.5 mr-0.5" />
              { task.images.length }
            </span>
          ) }
        </div>

        { task.assignments && task.assignments.length > 0 && (
          <div className="flex -space-x-1.5 shrink-0">
            { task.assignments.slice(0, 3).map((assignment) => (
              <div
                key={ assignment.user_id }
                className="w-5 h-5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] flex items-center justify-center text-[9px] border border-[var(--bg-primary)]"
                title={ assignment.user?.name }
              >
                { assignment.user?.name?.[0] || '?' }
              </div>
            )) }
            { task.assignments.length > 3 && (
              <div className="w-5 h-5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] flex items-center justify-center text-[9px] border border-[var(--bg-primary)]">
                +{ task.assignments.length - 3 }
              </div>
            ) }
          </div>
        ) }
      </div>
    </Card>
  );
};

export const KanbanTaskCard = React.memo(KanbanTaskCardComponent);

const KanbanTaskComponent: React.FC<KanbanTaskProps> = ({
  task,
  phaseLabel,
  epicLabel,
  approvalStatus,
  onEdit,
  isReadOnly = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = React.useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
  }), [transform, transition]);


  return (
    <div
      ref={ setNodeRef }
      style={ style }
      { ...(isReadOnly ? {} : attributes) }
      { ...(isReadOnly ? {} : listeners) }
      onClick={ isReadOnly ? undefined : onEdit }
      className={ clsx(isReadOnly ? 'cursor-default' : 'cursor-pointer', isDragging ? 'opacity-70 scale-[0.98]' : 'opacity-100') }
    >
      <KanbanTaskCard
        task={ task }
        phaseLabel={ phaseLabel }
        epicLabel={ epicLabel }
        approvalStatus={ approvalStatus }
      />
    </div>
  );
};

export const KanbanTask = React.memo(KanbanTaskComponent);
