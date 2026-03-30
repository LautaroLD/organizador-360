import { createClient } from '@/lib/supabase/server';
import { preapproval } from '@/lib/mercadopago';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('id, mercadopago_subscription_id, status, cancel_at_period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!subscription || !subscription.mercadopago_subscription_id) {
      return NextResponse.json(
        { error: 'No se encontró suscripción para reactivar' },
        { status: 404 },
      );
    }

    try {
      await preapproval.update({
        id: subscription.mercadopago_subscription_id,
        body: { status: 'authorized' },
      });
    } catch (mpError) {
      console.error('Error reactivando suscripción en MP:', mpError);
      return NextResponse.json(
        {
          error:
            'No se pudo reactivar en Mercado Pago. Si la suscripción ya fue cancelada definitivamente, debes volver a suscribirte.',
        },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'active',
        cancel_at_period_end: false,
        canceled_at: null,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error reactivando suscripción en BD:', updateError);
      return NextResponse.json(
        { error: 'No se pudo actualizar la suscripción localmente' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Suscripción reactivada',
    });
  } catch (error: unknown) {
    console.error('Error reactivando suscripción:', error);
    const message =
      error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
