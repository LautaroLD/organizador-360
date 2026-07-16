import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  requireAuthUser,
  requireProjectMember,
  requireProTeamOps,
} from '@/lib/projectAccess';
import { writeAuditLog } from '@/lib/auditLog';
import { onboardProjectMember } from '@/lib/projectTemplates';

/**
 * Seeds role tags + first-7-days onboarding checklist for a project member (PRO).
 * Callable by the member themselves (after accepting an invite) or by Owner/Admin.
 */
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

    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
    };

    const supabase = await createClient();
    const auth = await requireAuthUser(supabase);
    if (auth.error) return auth.error;

    const membership = await requireProjectMember(
      supabase,
      projectId,
      auth.user.id,
    );
    if (membership.error) return membership.error;

    const targetUserId = body.userId?.trim() || auth.user.id;
    const isSelf = targetUserId === auth.user.id;

    if (!isSelf && !membership.access.isOwnerOrAdmin) {
      return NextResponse.json(
        { error: 'Solo puedes iniciar tu propio onboarding o ser Owner/Admin' },
        { status: 403 },
      );
    }

    const pro = await requireProTeamOps(
      supabase,
      projectId,
      'El onboarding de miembros está disponible solo para plan Pro',
    );
    if (!pro.ok) return pro.error;

    const result = await onboardProjectMember(supabaseAdmin, {
      projectId,
      userId: targetUserId,
      actorUserId: auth.user.id,
      skipOnboardingTaskForOwner: true,
    });

    if (result.tagsAssigned.length > 0 || result.onboardingTaskCreated) {
      await writeAuditLog(supabase, {
        projectId,
        actorId: auth.user.id,
        action: 'member.onboard',
        entityType: 'member',
        entityId: targetUserId,
        metadata: {
          template_id: result.templateId,
          tags_assigned: result.tagsAssigned,
          onboarding_task_created: result.onboardingTaskCreated,
        },
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error onboarding project member:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error al iniciar el onboarding',
      },
      { status: 500 },
    );
  }
}
