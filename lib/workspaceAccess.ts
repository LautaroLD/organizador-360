import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getUserPlanTier } from '@/lib/subscriptionUtils';
import type { Workspace } from '@/models/workspace';

export async function requireProWorkspaceAccess(
  supabase: SupabaseClient,
  userId: string,
  errorMessage = 'El directorio de equipo está disponible solo para plan Pro',
) {
  const tier = await getUserPlanTier(supabase, userId);
  if (tier !== 'pro') {
    return {
      ok: false as const,
      tier,
      error: NextResponse.json({ error: errorMessage, code: 'pro_required' }, { status: 403 }),
    };
  }
  return { ok: true as const, tier, error: null };
}

export async function requireWorkspaceOwner(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
) {
  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error loading workspace:', error);
    return {
      workspace: null as null,
      error: NextResponse.json(
        { error: 'No se pudo cargar el workspace' },
        { status: 500 },
      ),
    };
  }

  if (!workspace) {
    return {
      workspace: null as null,
      error: NextResponse.json(
        { error: 'Workspace no encontrado' },
        { status: 404 },
      ),
    };
  }

  return { workspace: workspace as Workspace, error: null };
}

export function isMissingWorkspaceRelation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find the table')
  );
}
