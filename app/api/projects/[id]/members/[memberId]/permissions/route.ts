import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/auditLog';
import {
  isPermission,
  OVERRIDABLE_PERMISSIONS,
  type Permission,
  type PermissionOverride,
} from '@/lib/permissions';
import {
  requireAuthUser,
  requireProTeamOps,
  requireProjectMember,
} from '@/lib/projectAccess';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const { id: projectId, memberId } = await context.params;
    const supabase = await createClient();
    const { user, error: authError } = await requireAuthUser(supabase);
    if (authError || !user) return authError!;

    const { access, error: memberError } = await requireProjectMember(
      supabase,
      projectId,
      user.id,
    );
    if (memberError || !access) return memberError!;

    const { data: target, error: targetError } = await supabase
      .from('project_members')
      .select('id, role, user_id')
      .eq('id', memberId)
      .eq('project_id', projectId)
      .single();

    if (targetError || !target) {
      return NextResponse.json(
        { error: 'Miembro no encontrado' },
        { status: 404 },
      );
    }

    const { data: rows, error } = await supabase
      .from('project_member_permissions')
      .select('permission, granted')
      .eq('member_id', memberId);

    if (error) {
      console.error('Error fetching member permissions:', error);
      return NextResponse.json(
        { error: 'No se pudieron cargar los permisos' },
        { status: 500 },
      );
    }

    const overrides: PermissionOverride[] = (rows ?? [])
      .filter((row) => isPermission(row.permission))
      .map((row) => ({
        permission: row.permission as Permission,
        granted: Boolean(row.granted),
      }));

    return NextResponse.json({
      memberId,
      role: target.role,
      overrides,
      overridable: OVERRIDABLE_PERMISSIONS,
    });
  } catch (error) {
    console.error('GET member permissions error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const { id: projectId, memberId } = await context.params;
    const supabase = await createClient();
    const { user, error: authError } = await requireAuthUser(supabase);
    if (authError || !user) return authError!;

    const { access, error: memberError } = await requireProjectMember(
      supabase,
      projectId,
      user.id,
    );
    if (memberError || !access) return memberError!;

    if (!access.isOwnerOrAdmin) {
      return NextResponse.json(
        { error: 'Solo Owner o Admin pueden editar permisos' },
        { status: 403 },
      );
    }

    const pro = await requireProTeamOps(supabase, projectId);
    if (!pro.ok) return pro.error;

    const { data: target, error: targetError } = await supabase
      .from('project_members')
      .select('id, role, user_id')
      .eq('id', memberId)
      .eq('project_id', projectId)
      .single();

    if (targetError || !target) {
      return NextResponse.json(
        { error: 'Miembro no encontrado' },
        { status: 404 },
      );
    }

    const targetRole = String(target.role ?? '').toLowerCase();
    if (targetRole === 'owner' || targetRole === 'admin') {
      return NextResponse.json(
        {
          error:
            'Solo se pueden editar permisos de Collaborator o Viewer (Admin/Owner ya tienen acceso completo)',
        },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      overrides?: PermissionOverride[];
    } | null;

    const overrides = body?.overrides ?? [];
    const allowed = new Set(OVERRIDABLE_PERMISSIONS);

    for (const override of overrides) {
      if (!isPermission(override.permission) || !allowed.has(override.permission)) {
        return NextResponse.json(
          { error: `Permiso no válido: ${override.permission}` },
          { status: 400 },
        );
      }
    }

    const { error: deleteError } = await supabase
      .from('project_member_permissions')
      .delete()
      .eq('member_id', memberId);

    if (deleteError) {
      console.error('Error clearing permissions:', deleteError);
      return NextResponse.json(
        { error: 'No se pudieron actualizar los permisos' },
        { status: 500 },
      );
    }

    if (overrides.length > 0) {
      const { error: insertError } = await supabase
        .from('project_member_permissions')
        .insert(
          overrides.map((o) => ({
            member_id: memberId,
            permission: o.permission,
            granted: o.granted,
          })),
        );

      if (insertError) {
        console.error('Error inserting permissions:', insertError);
        return NextResponse.json(
          { error: 'No se pudieron guardar los permisos' },
          { status: 500 },
        );
      }
    }

    await writeAuditLog(supabase, {
      projectId,
      actorId: user.id,
      action: 'member.permissions_update',
      entityType: 'member',
      entityId: memberId,
      metadata: {
        target_user_id: target.user_id,
        overrides,
      },
    });

    return NextResponse.json({ ok: true, overrides });
  } catch (error) {
    console.error('PUT member permissions error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
