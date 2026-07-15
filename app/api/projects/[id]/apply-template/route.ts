import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  requireAuthUser,
  requireProjectMember,
  requireProTeamOps,
} from '@/lib/projectAccess';
import { writeAuditLog } from '@/lib/auditLog';
import {
  applyProjectTemplate,
  detectProjectTemplateId,
  getProjectTemplate,
  isProjectTemplateId,
} from '@/lib/projectTemplates';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const auth = await requireAuthUser(supabase);
    if (auth.error) return auth.error;

    const membership = await requireProjectMember(
      supabase,
      projectId,
      auth.user.id,
    );
    if (membership.error) return membership.error;

    const templateId = await detectProjectTemplateId(supabaseAdmin, projectId);
    return NextResponse.json({
      applied: templateId !== null,
      templateId,
      templateName: templateId
        ? getProjectTemplate(templateId)?.name ?? templateId
        : null,
    });
  } catch (error) {
    console.error('Error checking project template:', error);
    return NextResponse.json(
      { error: 'Error al consultar la plantilla del proyecto' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      templateId?: unknown;
    } | null;

    if (!isProjectTemplateId(body?.templateId)) {
      return NextResponse.json(
        { error: 'Plantilla inválida. Usa startup, agency o product.' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const auth = await requireAuthUser(supabase);
    if (auth.error) return auth.error;

    const membership = await requireProjectMember(
      supabase,
      projectId,
      auth.user.id,
    );
    if (membership.error) return membership.error;

    if (!membership.access.isOwnerOrAdmin) {
      return NextResponse.json(
        { error: 'Solo Owner o Admin pueden aplicar plantillas' },
        { status: 403 },
      );
    }

    const pro = await requireProTeamOps(
      supabase,
      projectId,
      'Las plantillas de proyecto están disponibles solo para plan Pro',
    );
    if (!pro.ok) return pro.error;

    const alreadyApplied = await detectProjectTemplateId(
      supabaseAdmin,
      projectId,
    );
    if (alreadyApplied) {
      const name =
        getProjectTemplate(alreadyApplied)?.name ?? alreadyApplied;
      return NextResponse.json(
        {
          error: `Este proyecto ya tiene la plantilla "${name}". No se puede aplicar otra.`,
          templateId: alreadyApplied,
        },
        { status: 409 },
      );
    }

    const result = await applyProjectTemplate(supabaseAdmin, {
      projectId,
      templateId: body.templateId,
      actorUserId: auth.user.id,
    });

    await writeAuditLog(supabase, {
      projectId,
      actorId: auth.user.id,
      action: 'project.template_applied',
      entityType: 'project',
      entityId: projectId,
      metadata: {
        template_id: result.templateId,
        channels_created: result.channelsCreated,
        tags_created: result.tagsCreated,
        tasks_created: result.tasksCreated,
      },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error applying project template:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Error al aplicar la plantilla';
    const status = message.includes('ya tiene la plantilla') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
