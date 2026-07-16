import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/auditLog';
import { sendPushNotificationToUser } from '@/lib/push-notifications';
import {
  requireAuthUser,
  requireProTeamOps,
  requireProjectMember,
} from '@/lib/projectAccess';
import type { ApprovalEntityType } from '@/models/approval';

type CreateBody = {
  projectId?: string;
  entityType?: ApprovalEntityType;
  entityId?: string;
  reviewerId?: string;
  requestNote?: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await requireAuthUser(supabase);
    if (authError || !user) return authError!;

    const body = (await request.json().catch(() => null)) as CreateBody | null;
    if (!body?.projectId || !body.entityId || !body.reviewerId) {
      return NextResponse.json(
        { error: 'projectId, entityId y reviewerId son requeridos' },
        { status: 400 },
      );
    }

    const entityType: ApprovalEntityType = body.entityType ?? 'task';
    if (entityType !== 'task' && entityType !== 'resource') {
      return NextResponse.json({ error: 'entityType inválido' }, { status: 400 });
    }

    const { access, error: memberError } = await requireProjectMember(
      supabase,
      body.projectId,
      user.id,
    );
    if (memberError || !access) return memberError!;

    if (access.normalizedRole === 'viewer') {
      return NextResponse.json(
        { error: 'Los viewers no pueden solicitar revisiones' },
        { status: 403 },
      );
    }

    const pro = await requireProTeamOps(supabase, body.projectId);
    if (!pro.ok) return pro.error;

    if (body.reviewerId === user.id) {
      return NextResponse.json(
        { error: 'No puedes asignarte a ti mismo como revisor' },
        { status: 400 },
      );
    }

    const { data: reviewerMember, error: reviewerError } = await supabase
      .from('project_members')
      .select('role, user:users(id, name, email)')
      .eq('project_id', body.projectId)
      .eq('user_id', body.reviewerId)
      .single();

    if (reviewerError || !reviewerMember) {
      return NextResponse.json(
        { error: 'El revisor debe ser miembro del proyecto' },
        { status: 400 },
      );
    }

    const reviewerRole = String(reviewerMember.role ?? '').toLowerCase();
    if (reviewerRole !== 'owner' && reviewerRole !== 'admin') {
      return NextResponse.json(
        { error: 'El revisor debe ser Owner o Admin' },
        { status: 400 },
      );
    }

    let entityTitle = 'Elemento';
    if (entityType === 'task') {
      const { data: task } = await supabase
        .from('tasks')
        .select('id, title, project_id')
        .eq('id', body.entityId)
        .eq('project_id', body.projectId)
        .single();
      if (!task) {
        return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
      }
      entityTitle = task.title;
    } else {
      const { data: resource } = await supabase
        .from('resources')
        .select('id, title, project_id')
        .eq('id', body.entityId)
        .eq('project_id', body.projectId)
        .single();
      if (!resource) {
        return NextResponse.json(
          { error: 'Recurso no encontrado' },
          { status: 404 },
        );
      }
      entityTitle = resource.title;
    }

    const { data: approval, error: insertError } = await supabase
      .from('approval_requests')
      .insert({
        project_id: body.projectId,
        entity_type: entityType,
        entity_id: body.entityId,
        requester_id: user.id,
        reviewer_id: body.reviewerId,
        status: 'pending',
        request_note: body.requestNote?.trim() || null,
      })
      .select(
        `
        *,
        project:projects(name),
        requester:users!requester_id(id, name, email),
        reviewer:users!reviewer_id(id, name, email)
      `,
      )
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe una revisión pendiente para este elemento' },
          { status: 409 },
        );
      }
      console.error('Error creating approval:', insertError);
      return NextResponse.json(
        { error: 'No se pudo crear la solicitud de revisión' },
        { status: 500 },
      );
    }

    await writeAuditLog(supabase, {
      projectId: body.projectId,
      actorId: user.id,
      action: 'approval.request',
      entityType,
      entityId: body.entityId,
      metadata: {
        approval_id: approval.id,
        reviewer_id: body.reviewerId,
        title: entityTitle,
      },
    });

    const projectName =
      (approval.project as { name?: string } | null)?.name ?? 'proyecto';

    void sendPushNotificationToUser(body.reviewerId, {
      title: 'Revisión pendiente',
      body: `${user.user_metadata?.name || 'Un miembro'} pide revisión de "${entityTitle}" en ${projectName}`,
      tag: `approval-${approval.id}`,
      data: {
        url: '/dashboard',
        approvalId: approval.id,
        projectId: body.projectId,
      },
    });

    return NextResponse.json({ approval: { ...approval, entity_title: entityTitle } });
  } catch (error) {
    console.error('POST /api/approvals error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
