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
    <Card className="p-3 bg-[var(--bg-primary)] hover:border-[var(--accent-primary)]/60 transition-all hover:shadow-md border border-transparent flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm leading-snug text-[var(--text-primary)] line-clamp-2">{ task.title }</p>
        { task.priority && (
          <p className={ clsx('text-[11px] uppercase border py-1 px-2 rounded-full w-fit font-semibold shrink-0 inline-flex items-center gap-1', priorityStyles[task.priority]) }>
            <Flag className="w-3 h-3" />
            { task.priority }
          </p>
        ) }
      </div>

      { approvalBadge && (
        <p className={ clsx('text-[11px] border py-1 px-2 rounded-full w-fit font-medium inline-flex items-center gap-1', approvalBadge.className) }>
          <ClipboardCheck className="w-3 h-3" />
          { approvalBadge.label }
        </p>
      ) }

      { task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          { task.tags.map((t) => (
            <span
              key={ t.id }
              className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
              style={ { backgroundColor: t.tag.color } }
            >
              { t.tag.label }
            </span>
          )) }
        </div>
      ) }

      { task.description && (
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
          { task.description }
        </p>
      ) }

      <div className="flex flex-wrap gap-1.5">
        { phaseLabel && (
          <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1 border border-[var(--text-secondary)]/20 py-1 px-2 rounded-full bg-[var(--bg-secondary)] inline-flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            { phaseLabel }
          </p>
        ) }
        { epicLabel && (
          <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1 border border-[var(--text-secondary)]/20 py-1 px-2 rounded-full bg-[var(--bg-secondary)] inline-flex items-center gap-1.5">
            <FolderKanban className="w-3 h-3" />
            { epicLabel }
          </p>
        ) }
      </div>

      { task.done_estimated_at && (
        <p className={ clsx(
          'text-[11px] line-clamp-1 border py-1 px-2 rounded-full inline-flex items-center gap-1.5 w-fit',
          isOverdue
            ? 'text-red-700 border-red-500/30 bg-red-500/10'
            : 'text-[var(--text-secondary)] border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)]'
        ) }>
          <CalendarClock className="w-3 h-3" />
          Cierre: { formatLocalDate(task.done_estimated_at) }
        </p>
      ) }

      <div className="flex justify-between items-center mt-1 pt-1 border-t border-[var(--text-secondary)]/10">
        <div className="flex items-center gap-2">
          { task.checklist && task.checklist.length > 0 && (
            <div className="flex items-center text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/15 px-2 py-1 rounded-md">
              <CheckSquare className="w-3 h-3 mr-1" />
              <span>
                { task.checklist.filter(i => i.is_completed).length }/{ task.checklist.length }
              </span>
            </div>
          ) }

          { task.images && task.images.length > 0 && (
            <div className="flex items-center text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/15 px-2 py-1 rounded-md">
              <ImageIcon className="w-3 h-3 mr-1" />
              <span>{ task.images.length }</span>
            </div>
          ) }
        </div>

        <div className="flex -space-x-2 ml-auto">
          { task.assignments?.map((assignment) => (
            <div
              key={ assignment.user_id }
              className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] flex items-center justify-center text-xs border-2 border-[var(--bg-primary)]"
              title={ assignment.user?.name }
            >
              { assignment.user?.name?.[0] || '?' }
            </div>
          )) }
        </div>
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
