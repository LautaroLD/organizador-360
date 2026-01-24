import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call the function to disable excess projects
    const { data, error } = await supabase.rpc('disable_excess_projects', {
      p_user_id: user.id
    });

    if (error) {
      console.error('Error disabling excess projects:', error);
      return NextResponse.json(
        { error: 'Error al deshabilitar proyectos en exceso' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      disabled_count: data,
      message: data > 0 
        ? `Se deshabilitaron ${data} proyecto(s)` 
        : 'No hay proyectos en exceso'
    });

  } catch (error) {
    console.error('Error in disable-excess-projects:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check enabled projects limit
    const { data, error } = await supabase.rpc('check_enabled_projects_limit', {
      p_user_id: user.id
    });

    if (error) {
      console.error('Error checking projects limit:', error);
      return NextResponse.json(
        { error: 'Error al verificar límite de proyectos' },
        { status: 500 }
      );
    }

    return NextResponse.json(data?.[0] || {
      can_enable: false,
      enabled_count: 0,
      limit: 3,
      is_premium: false
    });

  } catch (error) {
    console.error('Error in check-projects-limit:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
