export type AuditAction =
  | 'member.invite'
  | 'member.role_change'
  | 'member.remove'
  | 'member.permissions_update'
  | 'resource.delete'
  | 'approval.request'
  | 'approval.resolve'
  | 'task.delete'
  | string;

export interface AuditLog {
  id: string;
  project_id: string;
  actor_id: string | null;
  action: AuditAction;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

export interface WriteAuditLogInput {
  projectId: string;
  actorId: string;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}
