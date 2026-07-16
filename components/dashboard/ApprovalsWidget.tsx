'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Lock,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ApprovalRequest, ApprovalStatus } from '@/models/approval';

const STATUS_ACTIONS: Array<{
  status: Exclude<ApprovalStatus, 'pending'>;
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  icon: React.ReactNode;
  requiresNote: boolean;
}> = [
  {
    status: 'approved',
    label: 'Aprobar',
    variant: 'primary',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    requiresNote: false,
  },
  {
    status: 'rejected',
    label: 'Rechazar',
    variant: 'danger',
    icon: <XCircle className="h-3.5 w-3.5" />,
    requiresNote: true,
  },
  {
    status: 'blocked',
    label: 'Bloquear',
    variant: 'secondary',
    icon: <Lock className="h-3.5 w-3.5" />,
    requiresNote: true,
  },
];

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

export const ApprovalsWidget: React.FC = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const { data: approvals, isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const res = await fetch('/api/approvals/pending');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al cargar aprobaciones');
      }
      const json = (await res.json()) as { approvals: ApprovalRequest[] };
      return json.approvals;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const resolveMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      resolutionNote,
    }: {
      id: string;
      status: Exclude<ApprovalStatus, 'pending'>;
      resolutionNote?: string;
    }) => {
      const res = await fetch(`/api/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          resolutionNote: resolutionNote?.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo resolver');
      return body;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      setExpandedId((current) =>
        current === variables.id ? null : current,
      );
      setNotesById((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      toast.success('Revisión actualizada');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => setResolvingId(null),
  });

  if (isLoading || !approvals || approvals.length === 0) {
    return null;
  }

  return (
    <Card className="border-[var(--accent-primary)]/40 bg-[var(--bg-secondary)]">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardCheck className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Pendiente de mi aprobación
          </p>
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
            {approvals.length}
          </span>
        </div>

        <ul className="divide-y divide-[var(--text-secondary)]/15 max-h-64 overflow-y-auto">
          {approvals.map((approval) => {
            const projectId = approval.project_id;
            const kanbanUrl =
              approval.entity_type === 'task'
                ? `/projects/${projectId}/kanban`
                : `/projects/${projectId}/resources`;
            const isExpanded = expandedId === approval.id;
            const resolutionNote = notesById[approval.id] ?? '';
            const requester =
              approval.requester?.name ||
              approval.requester?.email ||
              'Alguien';

            return (
              <li key={approval.id} className="py-2 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() =>
                      setExpandedId((current) =>
                        current === approval.id ? null : approval.id,
                      )
                    }
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-[var(--text-secondary)] shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-[var(--text-secondary)] shrink-0" />
                      )}
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {approval.entity_title || 'Sin título'}
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)] shrink-0">
                        {formatTimeAgo(approval.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate pl-5">
                      {requester} · {approval.project?.name ?? 'proyecto'}
                      {approval.request_note ? ` · “${approval.request_note}”` : ''}
                    </p>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 shrink-0"
                    onClick={() => router.push(kanbanUrl)}
                    title="Abrir en el proyecto"
                  >
                    Ver
                  </Button>
                </div>

                {isExpanded && (
                  <div className="mt-2 ml-5 space-y-2">
                    <input
                      value={resolutionNote}
                      onChange={(e) =>
                        setNotesById((prev) => ({
                          ...prev,
                          [approval.id]: e.target.value,
                        }))
                      }
                      placeholder="Motivo (obligatorio al rechazar/bloquear)"
                      className="w-full h-8 px-2 rounded-md bg-[var(--bg-primary)] border border-[var(--text-secondary)]/25 text-[var(--text-primary)] text-xs"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_ACTIONS.map((action) => (
                        <Button
                          key={action.status}
                          size="sm"
                          variant={action.variant}
                          className="h-7 px-2 text-xs gap-1"
                          disabled={
                            resolvingId === approval.id ||
                            resolveMutation.isPending
                          }
                          onClick={() => {
                            const trimmed = resolutionNote.trim();
                            if (action.requiresNote && !trimmed) {
                              toast.error(
                                'Indicá un motivo para rechazar o bloquear',
                              );
                              return;
                            }
                            setResolvingId(approval.id);
                            resolveMutation.mutate({
                              id: approval.id,
                              status: action.status,
                              resolutionNote: trimmed || undefined,
                            });
                          }}
                        >
                          {action.icon}
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
};
