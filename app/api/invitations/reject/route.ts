import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ success: false, error: 'token es requerido' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: 'Configuracion incompleta del servidor' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: invitation, error: invitationError } = await supabase
      .from('project_invitations')
      .select('id, status, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (invitationError || !invitation) {
      return NextResponse.json({ success: false, error: 'Invitacion no encontrada' }, { status: 404 });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: 'Esta invitacion ha expirado' }, { status: 410 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        {
          success: true,
          status: invitation.status,
          message: invitation.status === 'accepted'
            ? 'La invitacion ya fue aceptada'
            : 'La invitacion ya fue rechazada',
        },
        { status: 200 }
      );
    }

    const { error: updateError } = await supabase
      .from('project_invitations')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)
      .eq('status', 'pending');

    if (updateError) {
      return NextResponse.json({ success: false, error: 'No se pudo rechazar la invitacion' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: 'rejected' }, { status: 200 });
  } catch {
    return NextResponse.json({ success: false, error: 'Error al rechazar invitacion' }, { status: 500 });
  }
}
