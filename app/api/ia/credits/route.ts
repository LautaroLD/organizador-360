import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAICreditStatus } from '@/lib/aiCredits';

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const status = await getAICreditStatus(supabase, user.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting AI credit status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
