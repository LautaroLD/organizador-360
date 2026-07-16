'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Shield } from 'lucide-react';
import { formatAuditAction } from '@/lib/auditLog';
import type { AuditLog } from '@/models/audit';

interface AuditLogPanelProps {
  projectId: string;
  enabled?: boolean;
}

export const AuditLogPanel: React.FC<AuditLogPanelProps> = ({
  projectId,
  enabled = true,
}) => {
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['project-audit', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/audit?limit=40`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'No se pudo cargar el historial');
      }
      return body.logs as AuditLog[];
    },
    enabled: enabled && !!projectId,
    staleTime: 30_000,
  });

  if (!enabled) return null;

  return (
    <div className="mt-10 border-t border-[var(--text-secondary)]/20 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-[var(--accent-primary)]" />
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Auditoría
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Acciones sensibles del proyecto (PRO)
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-[var(--text-secondary)]">Cargando historial…</p>
      )}

      {error && (
        <p className="text-sm text-[var(--accent-danger)]">
          {(error as Error).message}
        </p>
      )}

      {!isLoading && !error && (!logs || logs.length === 0) && (
        <p className="text-sm text-[var(--text-secondary)]">
          Todavía no hay eventos registrados.
        </p>
      )}

      {logs && logs.length > 0 && (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li
              key={log.id}
              className="bg-[var(--bg-secondary)] rounded-lg px-3 py-2 border border-[var(--text-secondary)]/15"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                    <History className="h-3.5 w-3.5 shrink-0" />
                    {formatAuditAction(log.action)}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {log.actor?.name || log.actor?.email || 'Usuario'}
                    {log.entity_type ? ` · ${log.entity_type}` : ''}
                    {typeof log.metadata?.title === 'string'
                      ? ` · ${log.metadata.title}`
                      : ''}
                    {typeof log.metadata?.new_role === 'string'
                      ? ` · → ${log.metadata.new_role}`
                      : ''}
                  </p>
                </div>
                <time className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('es-AR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
