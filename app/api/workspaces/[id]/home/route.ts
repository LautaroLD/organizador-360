import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthUser } from '@/lib/projectAccess';
import {
  requireProWorkspaceAccess,
  requireWorkspaceOwner,
} from '@/lib/workspaceAccess';
import { buildWorkspaceHomeSnapshot } from '@/lib/workspaceService';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params;
    const supabase = await createClient();
    const { user, error: authError } = await requireAuthUser(supabase);
    if (authError || !user) return authError!;

    const pro = await requireProWorkspaceAccess(supabase, user.id);
    if (!pro.ok) return pro.error;

    const { workspace, error: accessError } = await requireWorkspaceOwner(
      supabase,
      workspaceId,
      user.id,
    );
    if (accessError || !workspace) return accessError!;

    const home = await buildWorkspaceHomeSnapshot(supabase, workspace.id, user.id);
    return NextResponse.json({ home });
  } catch (error) {
    console.error('GET /api/workspaces/[id]/home error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
