import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type ThemeMode = 'light' | 'dark';

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;

const isValidTheme = (value: unknown): value is ThemeMode => {
  return value === 'light' || value === 'dark';
};

const isValidColorOrNull = (value: unknown): value is string | null => {
  return value === null || (typeof value === 'string' && HEX_COLOR_REGEX.test(value));
};

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const theme = body?.theme;
    const color = body?.color;

    if (!isValidTheme(theme)) {
      return NextResponse.json(
        { error: 'Tema inválido. Debe ser "light" o "dark".' },
        { status: 400 }
      );
    }

    if (!isValidColorOrNull(color)) {
      return NextResponse.json(
        { error: 'Color inválido. Debe ser hexadecimal (#RRGGBB) o null.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const column = theme === 'light' ? 'custom_color_light' : 'custom_color_dark';
    const payload: Record<string, string | null> = {
      [column]: color,
    };

    const { error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating theme color:', error);
      return NextResponse.json(
        { error: 'No se pudo actualizar el color personalizado' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in update-theme-colors route:', error);
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    );
  }
}
