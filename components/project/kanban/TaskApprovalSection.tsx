'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  CheckCircle2,
  ClipboardCheck,
  Lock,
  Send,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import type { ApprovalRequest, ApprovalStatus } from '@/models/approval';
import { useAuthStore } from '@/store/authStore';

interface TaskApprovalSectionProps {
  projectId: string;
  taskId: string;
  enabled: boolean;
}

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: 'Necesita revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  blocked: 'Bloqueado',
};

export const TaskApprovalSection: React.FC<TaskApprovalSectionProps> = ({
  projectId,
  taskId,
  enabled,
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [reviewerId, setReviewerId] = useState('');
  const [note, setNote] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  const { data: reviewers = [] } = useQuery({
    queryKey: ['approval-reviewers', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_members')
        .select(
          `
          user_id,
          role,
          user:users(id, name, email)
        `,
        )
        .eq('project_id', projectId)
        .in('role', ['Owner', 'Admin']);
      if (error) throw error;
      return (data ?? []).filter((m) => m.user_id !== user?.id);
    },
    enabled: enabled && !!projectId,
  });

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['task-approvals', projectId, taskId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/approvals`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Error al cargar revisiones');
      return (body.approvals as ApprovalRequest[]).filter(
        (a) => a.entity_type === 'task' && a.entity_id === taskId,
      );
    },
    enabled: enabled && !!projectId && !!taskId,
  });

  const pending = useMemo(
    () => approvals.find((a) => a.status === 'pending') ?? null,
    [approvals],
  );
  const latest = approvals[0] ?? null;

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          entityType: 'task',
          entityId: taskId,
          reviewerId,
          requestNote: note.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo solicitar revisión');
      return body;
    },
    onSuccess: () => {
      toast.success('Revisión solicitada');
      setNote('');
      queryClient.invalidateQueries({
        queryKey: ['task-approvals', projectId, taskId],
      });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['project-approvals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-approvals-map', projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resolveMutation = useMutation({
    mutationFn: async (status: Exclude<ApprovalStatus, 'pending'>) => {
      if (!pending) throw new Error('No hay revisión pendiente');
      const trimmed = resolutionNote.trim();
      if ((status === 'rejected' || status === 'blocked') && !trimmed) {
        throw new Error('Indicá un motivo para rechazar o bloquear');
      }
      const res = await fetch(`/api/approvals/${pending.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          resolutionNote: trimmed || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo resolver');
      return body;
    },
    onSuccess: () => {
      toast.success('Revisión actualizada');
      setResolutionNote('');
      queryClient.invalidateQueries({
        queryKey: ['task-approvals', projectId, taskId],
      });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['project-approvals-map', projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!enabled) {
    return (
      <div className="rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-3">
        <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Aprobaciones y handoffs disponibles en plan Pro
        </p>
      </div>
    );
  }

  const canResolve = !!pending && pending.reviewer_id === user?.id;

  return (
    <div className="rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-[var(--accent-primary)]" />
          Revisión / handoff
        </h4>
        {latest && (
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
              latest.status === 'approved'
                ? 'border-emerald-500/40 text-emerald-700 bg-emerald-500/10'
                : latest.status === 'pending'
                  ? 'border-amber-500/40 text-amber-700 bg-amber-500/10'
                  : latest.status === 'blocked'
                    ? 'border-red-500/40 text-red-700 bg-red-500/10'
                    : 'border-[var(--text-secondary)]/30 text-[var(--text-secondary)]'
            }`}
          >
            {STATUS_LABEL[latest.status]}
          </span>
        )}
      </div>

      {isLoading && (
        <p className="text-xs text-[var(--text-secondary)]">Cargando…</p>
      )}

      {pending && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-secondary)]">
            Revisor:{' '}
            {pending.reviewer?.name ||
              pending.reviewer?.email ||
              'Asignado'}
            {pending.request_note ? ` · “${pending.request_note}”` : ''}
          </p>
          {canResolve && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                Motivo / comentario del revisor
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={2}
                placeholder="Explicá el motivo (obligatorio al rechazar o bloquear)"
                className="w-full p-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--text-secondary)] text-[var(--text-primary)] text-sm resize-y"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => resolveMutation.mutate('approved')}
                  disabled={resolveMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Aprobar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => resolveMutation.mutate('rejected')}
                  disabled={resolveMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Rechazar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => resolveMutation.mutate('blocked')}
                  disabled={resolveMutation.isPending}
                >
                  <Lock className="h-4 w-4 mr-1" />
                  Bloquear
                </Button>
              </div>
            </div>
          )}
          {!canResolve && (
            <p className="text-xs text-[var(--text-secondary)]">
              Solo el revisor asignado puede completar esta revisión.
            </p>
          )}
        </div>
      )}

      {!pending && latest && latest.status !== 'pending' && latest.resolution_note && (
        <p className="text-xs text-[var(--text-secondary)] italic">
          Comentario del revisor: “{latest.resolution_note}”
        </p>
      )}

      {!pending && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            Asignar revisor (Owner/Admin)
          </label>
          <select
            value={reviewerId}
            onChange={(e) => setReviewerId(e.target.value)}
            className="w-full p-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--text-secondary)] text-[var(--text-primary)] text-sm"
          >
            <option value="">Seleccionar…</option>
            {reviewers.map((member) => {
              const u = Array.isArray(member.user)
                ? member.user[0]
                : member.user;
              return (
                <option key={member.user_id} value={member.user_id}>
                  {(u as { name?: string; email?: string } | null)?.name ||
                    (u as { email?: string } | null)?.email ||
                    member.user_id}{' '}
                  ({member.role})
                </option>
              );
            })}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota opcional para el revisor"
            className="w-full p-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--text-secondary)] text-[var(--text-primary)] text-sm"
          />
          <Button
            type="button"
            size="sm"
            disabled={!reviewerId || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <Send className="h-4 w-4 mr-1" />
            Solicitar revisión
          </Button>
        </div>
      )}
    </div>
  );
};
