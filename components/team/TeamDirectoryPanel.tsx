'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  ChevronDown,
  FolderKanban,
  Plus,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { WorkspaceBundle, WorkspaceMember, WorkspaceProject } from '@/models/workspace';
import clsx from 'clsx';

type Props = {
  bundle: WorkspaceBundle;
};

function memberLabel(member: WorkspaceMember) {
  return member.user?.name || member.display_name || member.email;
}

function getActiveProjects(member: WorkspaceMember) {
  if (member.activeProjects && member.activeProjects.length > 0) {
    return member.activeProjects;
  }
  return (member.activeProjectIds ?? []).map((projectId) => ({
    projectId,
    projectName: 'Proyecto',
    role: '—',
  }));
}

export function TeamDirectoryPanel({ bundle }: Props) {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [assigning, setAssigning] = useState<WorkspaceMember | null>(null);
  const [openProjectLists, setOpenProjectLists] = useState<Set<string>>(() => new Set());

  const [email, setEmail] = useState('');

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [assignRole, setAssignRole] = useState<'Admin' | 'Collaborator' | 'Viewer'>(
    'Collaborator',
  );

  const toggleProjectList = (memberId: string) => {
    setOpenProjectLists((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const directoryMembers = useMemo(
    () =>
      bundle.members.filter(
        (member) => member.user_id !== bundle.workspace.owner_id,
      ),
    [bundle.members, bundle.workspace.owner_id],
  );

  const roleByProjectId = useMemo(() => {
    const map = new Map<string, string>();
    if (!assigning) return map;
    for (const project of getActiveProjects(assigning)) {
      map.set(project.projectId, project.role);
    }
    return map;
  }, [assigning]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['workspace'] });
    queryClient.invalidateQueries({ queryKey: ['workspace-home'] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspaces/${bundle.workspace.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo agregar');
      return body;
    },
    onSuccess: () => {
      toast.success('Persona agregada al directorio');
      setIsAddOpen(false);
      setEmail('');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(
        `/api/workspaces/${bundle.workspace.id}/members/${memberId}`,
        { method: 'DELETE' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo eliminar');
      return body;
    },
    onSuccess: () => {
      toast.success('Eliminado del directorio');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assigning) return;
      const res = await fetch(
        `/api/workspaces/${bundle.workspace.id}/members/${assigning.id}/assign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectIds: selectedProjectIds,
            role: assignRole,
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo asignar');
      return body as {
        assigned: string[];
        skipped: Array<{ projectId: string; reason: string }>;
      };
    },
    onSuccess: (result) => {
      if (!result) return;
      if (result.assigned.length > 0) {
        toast.success(`Asignado a ${result.assigned.length} proyecto(s)`);
      }
      if (result.skipped.length > 0) {
        toast.info(
          result.skipped
            .slice(0, 2)
            .map((s) => s.reason)
            .join(' · '),
        );
      }
      setAssigning(null);
      setSelectedProjectIds([]);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openAssign = (member: WorkspaceMember) => {
    setAssigning(member);
    setSelectedProjectIds([]);
    setAssignRole('Collaborator');
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Directorio del equipo
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Personas del workspace y sus permisos por proyecto. Asigná a varios
            proyectos sin reinvitar.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Agregar persona
        </Button>
      </div>

      {directoryMembers.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-[var(--text-secondary)]">
            El directorio está vacío. Agregá personas o vinculá proyectos para sembrar
            automáticamente.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {directoryMembers.map((member) => {
            const activeProjects = getActiveProjects(member);
            return (
              <Card key={member.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">
                        {memberLabel(member)}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {member.email}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => openAssign(member)}
                        aria-label="Asignar a proyectos"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                      {member.user_id !== bundle.workspace.owner_id && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            if (
                              confirm(
                                `¿Quitar a ${memberLabel(member)} del directorio?`,
                              )
                            ) {
                              deleteMutation.mutate(member.id);
                            }
                          }}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-[var(--accent-danger)]" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-[var(--text-secondary)]/20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleProjectList(member.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-primary)] transition-colors"
                      aria-expanded={openProjectLists.has(member.id)}
                    >
                      <ChevronDown
                        className={clsx(
                          'h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform',
                          openProjectLists.has(member.id) ? 'rotate-0' : '-rotate-90',
                        )}
                      />
                      <FolderKanban className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-secondary)]">
                        Permisos por proyecto
                      </span>
                      <span className="shrink-0 rounded-md bg-[var(--bg-primary)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
                        {activeProjects.length}
                      </span>
                    </button>

                    {openProjectLists.has(member.id) && (
                      <div className="max-h-40 space-y-1 overflow-y-auto border-t border-[var(--text-secondary)]/15 px-3 py-2">
                        {activeProjects.length === 0 ? (
                          <p className="text-xs text-[var(--text-secondary)]">
                            Sin proyectos activos en el workspace
                          </p>
                        ) : (
                          activeProjects.map((project) => (
                            <div
                              key={project.projectId}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="truncate text-[var(--text-primary)]">
                                {project.projectName}
                              </span>
                              <span className="shrink-0 rounded-md bg-[var(--bg-primary)] px-1.5 py-0.5 text-[var(--text-secondary)]">
                                {project.role}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Agregar al directorio"
      >
        <div className="space-y-3 p-1">
          <Input
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@empresa.com"
          />
          <p className="text-xs text-[var(--text-secondary)]">
            El rol/permiso se elige al asignar la persona a cada proyecto.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!email.trim() || addMutation.isPending}
            >
              Agregar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!assigning}
        onClose={() => setAssigning(null)}
        title={
          assigning
            ? `Asignar a proyectos — ${memberLabel(assigning)}`
            : 'Asignar a proyectos'
        }
        size="lg"
      >
        <div className="space-y-4 p-1">
          <p className="text-sm text-[var(--text-secondary)]">
            Se agregará como miembro del proyecto sin reenviar invitación (si ya tiene
            cuenta). El rol se aplica solo a los proyectos seleccionados.
          </p>

          {!assigning?.user_id && (
            <p className="text-sm text-[var(--accent-warning)]">
              Esta persona aún no tiene cuenta registrada. Primero debe crear una
              cuenta (por ejemplo aceptando una invitación a un proyecto).
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Rol en los proyectos seleccionados
            </label>
            <select
              className="w-full rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
              value={assignRole}
              onChange={(e) =>
                setAssignRole(e.target.value as 'Admin' | 'Collaborator' | 'Viewer')
              }
            >
              <option value="Collaborator">Collaborator</option>
              <option value="Admin">Admin</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {bundle.projects.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Vinculá proyectos al workspace primero.
              </p>
            ) : (
              bundle.projects.map((link: WorkspaceProject) => {
                const currentRole = roleByProjectId.get(link.project_id);
                const already = !!currentRole;
                const checked = selectedProjectIds.includes(link.project_id);
                return (
                  <label
                    key={link.id}
                    className="flex items-center gap-3 rounded-md border border-[var(--text-secondary)]/20 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={already ? true : checked}
                      disabled={!!already || !assigning?.user_id}
                      onChange={() => toggleProject(link.project_id)}
                    />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm text-[var(--text-primary)]">
                      <span className="truncate">
                        {link.project?.name ?? 'Proyecto'}
                      </span>
                      {already ? (
                        <span className="shrink-0 text-xs text-[var(--text-secondary)]">
                          {currentRole}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAssigning(null)}>
              <X className="h-4 w-4 mr-1" />
              Cerrar
            </Button>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={
                !assigning?.user_id ||
                selectedProjectIds.length === 0 ||
                assignMutation.isPending
              }
            >
              Asignar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
