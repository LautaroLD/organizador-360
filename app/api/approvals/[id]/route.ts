import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/auditLog';
import { sendPushNotificationToUser } from '@/lib/push-notifications';
import {
  requireAuthUser,
  requireProTeamOps,
  requireProjectMember,
} from '@/lib/projectAccess';
import type { ApprovalStatus } from '@/models/approval';

type ResolveBody = {
  status?: Exclude<ApprovalStatus, 'pending'>;
  resolutionNote?: string;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const supabase = await createClient();
    const { user, error: authError } = await requireAuthUser(supabase);
    if (authError || !user) return authError!;

    const body = (await request.json().catch(() => null)) as ResolveBody | null;
    const nextStatus = body?.status;
    if (
      nextStatus !== 'approved' &&
      nextStatus !== 'rejected' &&
      nextStatus !== 'blocked'
    ) {
      return NextResponse.json(
        { error: 'status debe ser approved, rejected o blocked' },
        { status: 400 },
      );
    }

    const { data: existing, error: fetchError } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 },
      );
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'Esta solicitud ya fue resuelta' },
        { status: 409 },
      );
    }

    const { access, error: memberError } = await requireProjectMember(
      supabase,
      existing.project_id,
      user.id,
    );
    if (memberError || !access) return memberError!;

    if (existing.reviewer_id !== user.id) {
      return NextResponse.json(
        { error: 'Solo el revisor asignado puede resolver esta revisión' },
        { status: 403 },
      );
    }

    const pro = await requireProTeamOps(supabase, existing.project_id);
    if (!pro.ok) return pro.error;

    const { data: updated, error: updateError } = await supabase
      .from('approval_requests')
      .update({
        status: nextStatus,
        resolution_note: body?.resolutionNote?.trim() || null,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select(
        `
        *,
        project:projects(name),
        requester:users!requester_id(id, name, email),
        reviewer:users!reviewer_id(id, name, email)
      `,
      )
      .single();

    if (updateError || !updated) {
      console.error('Error resolving approval:', updateError);
      return NextResponse.json(
        { error: 'No se pudo resolver la solicitud' },
        { status: 500 },
      );
    }

    await writeAuditLog(supabase, {
      projectId: existing.project_id,
      actorId: user.id,
      action: 'approval.resolve',
      entityType: existing.entity_type,
      entityId: existing.entity_id,
      metadata: {
        approval_id: id,
        status: nextStatus,
        requester_id: existing.requester_id,
        resolution_note: body?.resolutionNote?.trim() || null,
      },
    });

    const statusLabel =
      nextStatus === 'approved'
        ? 'aprobada'
        : nextStatus === 'rejected'
          ? 'rechazada'
          : 'marcada como bloqueada';

    const noteSuffix = body?.resolutionNote?.trim()
      ? `: ${body.resolutionNote.trim()}`
      : '';

    void sendPushNotificationToUser(existing.requester_id, {
      title: 'Revisión resuelta',
      body: `Tu solicitud de revisión fue ${statusLabel}${noteSuffix}`,
      tag: `approval-resolved-${id}`,
      data: {
        url: `/projects/${existing.project_id}/kanban`,
        approvalId: id,
        projectId: existing.project_id,
        status: nextStatus,
      },
    });

    return NextResponse.json({ approval: updated });
  } catch (error) {
    console.error('PATCH /api/approvals/[id] error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
