'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Link2, Link2Off, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { WorkspaceBundle } from '@/models/workspace';

type Props = {
  bundle: WorkspaceBundle;
};

export function TeamProjectsPanel({ bundle }: Props) {
  const supabase = createClient();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const linkedIds = useMemo(
    () => new Set(bundle.projects.map((p) => p.project_id)),
    [bundle.projects],
  );

  const { data: ownedProjects = [] } = useQuery({
    queryKey: ['owned-projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, enabled')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && isOpen,
  });

  const unlinkable = ownedProjects.filter((p) => !linkedIds.has(p.id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['workspace'] });
    queryClient.invalidateQueries({ queryKey: ['workspace-home'] });
  };

  const linkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspaces/${bundle.workspace.id}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds: selected }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo vincular');
      return body;
    },
    onSuccess: () => {
      toast.success('Proyectos vinculados');
      setIsOpen(false);
      setSelected([]);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/workspaces/${bundle.workspace.id}/projects`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo desvincular');
      return body;
    },
    onSuccess: () => {
      toast.success('Proyecto desvinculado');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Proyectos del workspace
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Solo proyectos que poseés. El billing sigue anclado a tu plan PRO.
          </p>
        </div>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Vincular proyecto
        </Button>
      </div>

      {bundle.projects.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-[var(--text-secondary)]">
            No hay proyectos vinculados. Al crear el workspace se intentan vincular
            automáticamente tus proyectos.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {bundle.projects.map((link) => (
            <Card key={link.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <Link
                    href={`/projects/${link.project_id}/chat`}
                    className="font-medium text-[var(--text-primary)] hover:underline"
                  >
                    {link.project?.name ?? 'Proyecto'}
                  </Link>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {link.project?.enabled === false ? 'Deshabilitado · ' : ''}
                    Vinculado {new Date(link.added_at).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (confirm('¿Desvincular este proyecto del workspace?')) {
                      unlinkMutation.mutate(link.project_id);
                    }
                  }}
                >
                  <Link2Off className="h-3.5 w-3.5 mr-1" />
                  Desvincular
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Vincular proyectos"
      >
        <div className="space-y-4 p-1">
          {unlinkable.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Todos tus proyectos ya están vinculados (o no tenés proyectos propios).
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {unlinkable.map((project) => (
                <label
                  key={project.id}
                  className="flex items-center gap-3 rounded-md border border-[var(--text-secondary)]/20 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(project.id)}
                    onChange={() =>
                      setSelected((prev) =>
                        prev.includes(project.id)
                          ? prev.filter((id) => id !== project.id)
                          : [...prev, project.id],
                      )
                    }
                  />
                  <span className="text-sm text-[var(--text-primary)]">
                    {project.name}
                    {!project.enabled ? ' (deshabilitado)' : ''}
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => linkMutation.mutate()}
              disabled={selected.length === 0 || linkMutation.isPending}
            >
              <Link2 className="h-4 w-4 mr-1" />
              Vincular
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
