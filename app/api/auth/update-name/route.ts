import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_NAME_LENGTH = 80;

export async function PUT(request: Request) {
  try {
    const { name } = await request.json();

    const trimmedName = typeof name === 'string' ? name.trim() : '';

    if (!trimmedName) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `El nombre no puede exceder ${MAX_NAME_LENGTH} caracteres` },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Actualizar el nombre en user_metadata
    const { data, error } = await supabase.auth.updateUser({
      data: { name: trimmedName }
    });

    if (error) {
      console.error('Error updating name:', error);
      return NextResponse.json(
        { error: 'Error al actualizar el nombre' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      user: data.user
    });
  } catch (error) {
    console.error('Error in update-name route:', error);
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    );
  }
}
