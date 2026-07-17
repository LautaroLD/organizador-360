'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Trash2 } from 'lucide-react';
import type { ManageMemberModalProps } from '@/models';
import {
  OVERRIDABLE_PERMISSIONS,
  PERMISSION_LABELS,
  type Permission,
  type PermissionOverride,
} from '@/lib/permissions';

function buildPermissionMap(
  overrides: PermissionOverride[] = [],
): Record<Permission, boolean | null> {
  const next = {} as Record<Permission, boolean | null>;
  for (const permission of OVERRIDABLE_PERMISSIONS) {
    next[permission] = null;
  }
  for (const override of overrides) {
    next[override.permission] = override.granted;
  }
  return next;
}

export const ManageMemberModal: React.FC<ManageMemberModalProps> = ({
  member,
  onClose,
  onChangeRole,
  onRemove,
  isLoading,
  projectId,
  canEditPermissions = false,
}) => {
  const queryClient = useQueryClient();
  const [draftOverrides, setDraftOverrides] = useState<Record<
    Permission,
    boolean | null
  > | null>(null);
  const [draftMemberId, setDraftMemberId] = useState<string | null>(null);

  const memberId = member?.id ?? null;
  const showPermissions =
    canEditPermissions &&
    !!projectId &&
    !!member &&
    (member.role === 'Collaborator' || member.role === 'Viewer');

  // Reset local edits when switching members (adjust state during render).
  if (memberId !== draftMemberId) {
    setDraftMemberId(memberId);
    setDraftOverrides(null);
  }

  const { data: permissionsData, isLoading: loadingPermissions } = useQuery({
    queryKey: ['member-permissions', projectId, memberId],
    queryFn: async () => {
      const res = await fetch(
        `/api/projects/${projectId}/members/${memberId}/permissions`,
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Error al cargar permisos');
      return body as {
        overrides: PermissionOverride[];
        overridable: Permission[];
      };
    },
    enabled: showPermissions && !!memberId,
  });

  const baselineOverrides = useMemo(
    () => buildPermissionMap(permissionsData?.overrides),
    [permissionsData],
  );
  const effectiveOverrides = draftOverrides ?? baselineOverrides;

  const savePermissionsMutation = useMutation({
    mutationFn: async () => {
      const overrides: PermissionOverride[] = OVERRIDABLE_PERMISSIONS
        .filter((permission) => effectiveOverrides[permission] !== null)
        .map((permission) => ({
          permission,
          granted: Boolean(effectiveOverrides[permission]),
        }));

      const res = await fetch(
        `/api/projects/${projectId}/members/${memberId}/permissions`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ overrides }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudieron guardar');
      return body;
    },
    onSuccess: () => {
      toast.success('Permisos actualizados');
      setDraftOverrides(null);
      queryClient.invalidateQueries({
        queryKey: ['member-permissions', projectId, memberId],
      });
      // Invalidate all members' effective permissions in this project (local client).
      queryClient.invalidateQueries({ queryKey: ['my-permissions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-audit', projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!member) return null;
  const memberName = member.user?.name || 'Usuario';
  const memberEmail = member.user?.email || 'Sin email';

  const cyclePermission = (permission: Permission) => {
    setDraftOverrides((prev) => {
      const base = prev ?? baselineOverrides;
      const current = base[permission];
      const nextValue =
        current === null ? true : current === true ? false : null;
      return { ...base, [permission]: nextValue };
    });
  };

  const permissionStateLabel = (value: boolean | null) => {
    if (value === true) return 'Permitido';
    if (value === false) return 'Denegado';
    return 'Por rol';
  };

  return (
    <Modal isOpen={!!member} onClose={onClose} title={`Gestionar: ${memberName}`}>
      <div className='space-y-4'>
        <div className='bg-[var(--bg-primary)] p-3 rounded-lg'>
          <p className='text-sm text-[var(--text-secondary)]'>
            Email: <span className='text-[var(--text-primary)]'>{memberEmail}</span>
          </p>
          <p className='text-sm text-[var(--text-secondary)] mt-1'>
            Rol actual:{' '}
            <span className='text-[var(--text-primary)] font-semibold'>{member.role}</span>
          </p>
        </div>

        <div className='space-y-2'>
          <p className='text-sm font-medium text-[var(--text-primary)]'>Cambiar Rol:</p>
          <div className='grid grid-cols-3 gap-2'>
            {['Admin', 'Collaborator', 'Viewer'].map((role) => (
              <Button
                key={role}
                variant={member.role === role ? 'primary' : 'secondary'}
                size='sm'
                onClick={() => onChangeRole(member.id, role)}
                disabled={isLoading}
              >
                {role}
              </Button>
            ))}
          </div>
        </div>

        {showPermissions && (
          <div className='space-y-2 border-t border-[var(--text-secondary)]/20 pt-4'>
            <p className='text-sm font-medium text-[var(--text-primary)]'>
              Permisos granulares (PRO)
            </p>
            <p className='text-xs text-[var(--text-secondary)]'>
              Alterna entre Por rol → Permitido → Denegado. Solo aplica a
              Collaborator/Viewer.
            </p>
            {loadingPermissions ? (
              <p className='text-xs text-[var(--text-secondary)]'>Cargando…</p>
            ) : (
              <div className='space-y-1.5'>
                {OVERRIDABLE_PERMISSIONS.map((permission) => (
                  <button
                    key={permission}
                    type='button'
                    onClick={() => cyclePermission(permission)}
                    className='w-full flex items-center justify-between rounded-md border border-[var(--text-secondary)]/20 bg-[var(--bg-primary)] px-3 py-2 text-left text-sm hover:border-[var(--accent-primary)]/40'
                  >
                    <span className='text-[var(--text-primary)]'>
                      {PERMISSION_LABELS[permission]}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        effectiveOverrides[permission] === true
                          ? 'text-emerald-600'
                          : effectiveOverrides[permission] === false
                            ? 'text-red-600'
                            : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {permissionStateLabel(effectiveOverrides[permission] ?? null)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <Button
              size='sm'
              className='w-full'
              onClick={() => savePermissionsMutation.mutate()}
              disabled={savePermissionsMutation.isPending || loadingPermissions}
            >
              Guardar permisos
            </Button>
          </div>
        )}

        <div className='pt-4 border-t border-[var(--text-secondary)]/20'>
          <Button
            variant='danger'
            className='w-full'
            onClick={() => {
              if (confirm(`¿Estás seguro de eliminar a ${memberName} del proyecto?`)) {
                onRemove(member.id, memberName);
              }
            }}
            disabled={isLoading}
          >
            <Trash2 className='h-4 w-4 mr-2' />
            Eliminar del Proyecto
          </Button>
        </div>
      </div>
    </Modal>
  );
};
