import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/projectAccess';
import {
  requireProWorkspaceAccess,
  requireWorkspaceOwner,
} from '@/lib/workspaceAccess';

type RouteContext = { params: Promise<{ id: string }> };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params;
    const supabase = await createClient();
    const { user, error: authError } = await requireAuthUser(supabase);
    if (authError || !user) return authError!;

    const pro = await requireProWorkspaceAccess(supabase, user.id);
    if (!pro.ok) return pro.error;

    const { error: accessError } = await requireWorkspaceOwner(
      supabase,
      workspaceId,
      user.id,
    );
    if (accessError) return accessError;

    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      displayName?: string | null;
    };

    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id, name, email')
      .ilike('email', email)
      .maybeSingle();

    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .ilike('email', email)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json(
        { error: 'Esta persona ya está en el directorio' },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: existingUser?.id ?? null,
        email,
        display_name:
          (typeof body.displayName === 'string' && body.displayName.trim()) ||
          existingUser?.name ||
          null,
      })
      .select(
        `
        id,
        workspace_id,
        user_id,
        email,
        display_name,
        created_at,
        updated_at,
        user:users(id, name, email, avatar_url)
      `,
      )
      .single();

    if (error || !data) {
      console.error('Error adding workspace member:', error);
      return NextResponse.json(
        { error: 'No se pudo agregar al directorio' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { member: { ...data, activeProjects: [], activeProjectIds: [] } },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/workspaces/[id]/members error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
