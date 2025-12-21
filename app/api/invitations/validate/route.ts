import { createClient } from '@/lib/supabase/server';
import { canAddMemberToProject } from '@/lib/subscriptionUtils';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/invitations/validate
 * Valida si se puede agregar un miembro al proyecto según el plan de suscripción
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId es requerido' }, { status: 400 });
    }

    // Verificar que el usuario es el dueño o admin del proyecto
    const { data: member, error: memberError } = await supabase
      .from('project_members')
      .select('role, project:projects(owner_id)')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'No tienes acceso a este proyecto' },
        { status: 403 }
      );
    }

    // @ts-expect-error - project structure
    const ownerId = member.project.owner_id;

    // Verificar límites
    const validation = await canAddMemberToProject(supabase, projectId, ownerId);

    if (!validation.canAdd) {
      return NextResponse.json(
        {
          canAdd: false,
          reason: validation.reason,
          currentCount: validation.currentCount,
          limit: validation.limit,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        canAdd: true,
        currentCount: validation.currentCount,
        limit: validation.limit,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error validating invitation:', error);
    return NextResponse.json(
      { error: 'Error al validar invitación' },
      { status: 500 }
    );
  }
}
