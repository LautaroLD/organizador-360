import type { MemberRole } from '@/models/invitation';

export const PERMISSIONS = [
  'chat.write',
  'kanban.edit',
  'calendar.edit',
  'resources.upload',
  'resources.delete',
  'members.invite',
  'members.manage',
  'analytics.view',
  'approvals.review',
  'audit.view',
  'export.data',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type ProjectRole = 'Owner' | MemberRole;

export type PermissionOverride = {
  permission: Permission;
  granted: boolean;
};

const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

const ROLE_DEFAULTS: Record<ProjectRole, readonly Permission[]> = {
  Owner: ALL_PERMISSIONS,
  Admin: ALL_PERMISSIONS,
  Collaborator: [
    'chat.write',
    'kanban.edit',
    'calendar.edit',
    'resources.upload',
    'resources.delete',
  ],
  Viewer: [],
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'chat.write': 'Escribir en chat',
  'kanban.edit': 'Editar tablero',
  'calendar.edit': 'Editar calendario',
  'resources.upload': 'Subir recursos',
  'resources.delete': 'Eliminar recursos',
  'members.invite': 'Invitar miembros',
  'members.manage': 'Gestionar miembros',
  'analytics.view': 'Ver salud del equipo',
  'approvals.review': 'Revisar aprobaciones',
  'audit.view': 'Ver auditoría',
  'export.data': 'Exportar datos',
};

/** Permissions that Owner/Admin may grant as PRO overrides to Collaborator/Viewer. */
export const OVERRIDABLE_PERMISSIONS: Permission[] = [
  'chat.write',
  'kanban.edit',
  'calendar.edit',
  'resources.upload',
  'resources.delete',
  'members.invite',
];

export function normalizeProjectRole(role?: string | null): ProjectRole | null {
  if (!role) return null;
  const normalized = role.trim().toLowerCase();
  if (normalized === 'owner') return 'Owner';
  if (normalized === 'admin') return 'Admin';
  if (normalized === 'collaborator' || normalized === 'member') return 'Collaborator';
  if (normalized === 'viewer') return 'Viewer';
  return null;
}

export function getDefaultPermissions(role?: string | null): Set<Permission> {
  const normalized = normalizeProjectRole(role);
  if (!normalized) return new Set();
  return new Set(ROLE_DEFAULTS[normalized]);
}

export function resolvePermissions(
  role?: string | null,
  overrides: PermissionOverride[] = [],
): Set<Permission> {
  const granted = getDefaultPermissions(role);
  const normalizedRole = normalizeProjectRole(role);

  // Owner/Admin always keep full access; overrides only apply to limited roles.
  if (normalizedRole === 'Owner' || normalizedRole === 'Admin') {
    return granted;
  }

  for (const override of overrides) {
    if (!PERMISSIONS.includes(override.permission)) continue;
    if (override.granted) {
      granted.add(override.permission);
    } else {
      granted.delete(override.permission);
    }
  }

  return granted;
}

export function hasPermission(
  role: string | null | undefined,
  permission: Permission,
  overrides: PermissionOverride[] = [],
): boolean {
  return resolvePermissions(role, overrides).has(permission);
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
