import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/projectAccess';
import { requireProWorkspaceAccess } from '@/lib/workspaceAccess';
import { getOrCreateWorkspaceBundle } from '@/lib/workspaceService';

export async function GET() {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await requireAuthUser(supabase);
    if (authError || !user) return authError!;

    const pro = await requireProWorkspaceAccess(supabase, user.id);
    if (!pro.ok) return pro.error;

    const result = await getOrCreateWorkspaceBundle(supabase, user);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          code: result.missingSchema ? 'schema_missing' : 'workspace_error',
        },
        { status: result.missingSchema ? 503 : 500 },
      );
    }

    return NextResponse.json(result.bundle);
  } catch (error) {
    console.error('GET /api/workspaces error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await requireAuthUser(supabase);
    if (authError || !user) return authError!;

    const pro = await requireProWorkspaceAccess(supabase, user.id);
    if (!pro.ok) return pro.error;

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      description?: string | null;
    };

    const result = await getOrCreateWorkspaceBundle(supabase, user);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          code: result.missingSchema ? 'schema_missing' : 'workspace_error',
        },
        { status: result.missingSchema ? 503 : 500 },
      );
    }

    const updates: { name?: string; description?: string | null } = {};
    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (body.description !== undefined) {
      updates.description =
        typeof body.description === 'string' ? body.description.trim() || null : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ workspace: result.bundle.workspace });
    }

    const { data, error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', result.bundle.workspace.id)
      .eq('owner_id', user.id)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Error updating workspace:', error);
      return NextResponse.json({ error: 'No se pudo actualizar el workspace' }, { status: 500 });
    }

    return NextResponse.json({ workspace: data });
  } catch (error) {
    console.error('PATCH /api/workspaces error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
