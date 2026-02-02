import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'token es requerido' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración incompleta del servidor' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from('project_invitations')
      .select(`
        *,
        project:projects (
          name,
          description
        ),
        inviter:users (
          name,
          email
        )
      `)
      .eq('token', token)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ invitation: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error al resolver invitación' }, { status: 500 });
  }
}
