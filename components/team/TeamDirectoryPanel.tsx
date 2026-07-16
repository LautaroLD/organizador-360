'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  FolderKanban,
  Pencil,
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

type Props = {
  bundle: WorkspaceBundle;
};

function memberLabel(member: WorkspaceMember) {
  return member.display_name || member.user?.name || member.email;
}

export function TeamDirectoryPanel({ bundle }: Props) {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceMember | null>(null);
  const [assigning, setAssigning] = useState<WorkspaceMember | null>(null);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [orgRole, setOrgRole] = useState('');
  const [skillsInput, setSkillsInput] = useState('');

  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editSkills, setEditSkills] = useState('');

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [assignRole, setAssignRole] = useState<'Admin' | 'Collaborator' | 'Viewer'>(
    'Collaborator',
  );

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const link of bundle.projects) {
      map.set(link.project_id, link.project?.name ?? 'Proyecto');
    }
    return map;
  }, [bundle.projects]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['workspace'] });
    queryClient.invalidateQueries({ queryKey: ['workspace-home'] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const skills = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`/api/workspaces/${bundle.workspace.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          displayName: displayName || null,
          orgRole: orgRole || null,
          skills,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo agregar');
      return body;
    },
    onSuccess: () => {
      toast.success('Persona agregada al directorio');
      setIsAddOpen(false);
      setEmail('');
      setDisplayName('');
      setOrgRole('');
      setSkillsInput('');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const skills = editSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(
        `/api/workspaces/${bundle.workspace.id}/members/${editing.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: editName || null,
            orgRole: editRole || null,
            skills,
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo actualizar');
      return body;
    },
    onSuccess: () => {
      toast.success('Directorio actualizado');
      setEditing(null);
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

  const openEdit = (member: WorkspaceMember) => {
    setEditing(member);
    setEditName(member.display_name || member.user?.name || '');
    setEditRole(member.org_role || '');
    setEditSkills((member.skills ?? []).join(', '));
  };

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
            Skills, rol org y proyectos activos — asigná a varios proyectos sin reinvitar.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Agregar persona
        </Button>
      </div>

      {bundle.members.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-[var(--text-secondary)]">
            El directorio está vacío. Agregá personas o vinculá proyectos para sembrar
            automáticamente.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {bundle.members.map((member) => (
            <Card key={member.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      {memberLabel(member)}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">{member.email}</p>
                    {member.org_role && (
                      <p className="text-xs text-[var(--accent-primary)] mt-1">
                        {member.org_role}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => openEdit(member)}
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
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

                {(member.skills ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {member.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-xs px-2 py-0.5 rounded-md bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                  <FolderKanban className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    {(member.activeProjectIds ?? []).length === 0
                      ? 'Sin proyectos activos en el workspace'
                      : (member.activeProjectIds ?? [])
                          .map((id) => projectNameById.get(id) ?? 'Proyecto')
                          .join(', ')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
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
          <Input
            label="Nombre"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Opcional"
          />
          <Input
            label="Rol en la org"
            value={orgRole}
            onChange={(e) => setOrgRole(e.target.value)}
            placeholder="Ej. Design Lead"
          />
          <Input
            label="Skills (separadas por coma)"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            placeholder="React, QA, Facilitation"
          />
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
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title="Editar persona"
      >
        <div className="space-y-3 p-1">
          <Input
            label="Nombre"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <Input
            label="Rol en la org"
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
          />
          <Input
            label="Skills (separadas por coma)"
            value={editSkills}
            onChange={(e) => setEditSkills(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
              Guardar
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
            cuenta).
          </p>

          {!assigning?.user_id && (
            <p className="text-sm text-[var(--accent-warning)]">
              Esta persona aún no tiene cuenta vinculada. Primero debe aceptar una
              invitación a algún proyecto.
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Rol en los proyectos
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
                const already = assigning?.activeProjectIds?.includes(link.project_id);
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
                    <span className="text-sm text-[var(--text-primary)]">
                      {link.project?.name ?? 'Proyecto'}
                      {already ? (
                        <span className="ml-2 text-xs text-[var(--text-secondary)]">
                          (ya es miembro)
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
