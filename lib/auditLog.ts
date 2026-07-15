import type { SupabaseClient } from '@supabase/supabase-js';
import type { WriteAuditLogInput } from '@/models/audit';

export async function writeAuditLog(
  supabase: SupabaseClient,
  input: WriteAuditLogInput,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('audit_logs').insert({
    project_id: input.projectId,
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error('Failed to write audit log:', error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'member.invite': 'Invitación enviada',
  'member.role_change': 'Cambio de rol',
  'member.remove': 'Miembro eliminado',
  'member.permissions_update': 'Permisos actualizados',
  'resource.delete': 'Recurso eliminado',
  'approval.request': 'Revisión solicitada',
  'approval.resolve': 'Revisión resuelta',
  'task.delete': 'Tarea eliminada',
};

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
