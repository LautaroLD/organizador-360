import { createClient } from '@/lib/supabase/server';
import { preapproval } from '@/lib/mercadopago';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Obtener la suscripción activa
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('mercadopago_subscription_id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'authorized', 'trialing'])
      .single();

    if (!subscription || !subscription.mercadopago_subscription_id) {
      return NextResponse.json(
        { error: 'No se encontró una suscripción activa para cancelar' },
        { status: 404 }
      );
    }

    // Cancelar en Mercado Pago
    // Nota: status 'cancelled' es el usado por MP para cancelar
    await preapproval.update({
      id: subscription.mercadopago_subscription_id,
      body: { status: 'cancelled' },
    });

    // Actualizar base de datos local
    // (Opcional, el Webhook también lo haría, pero esto da feedback inmediato)
    const { error } = await supabase
      .from('subscriptions')
      .update({ 
        status: 'canceled', // Estado en BD local
        canceled_at: new Date().toISOString()
      })
      .eq('mercadopago_subscription_id', subscription.mercadopago_subscription_id);

    if (error) {
      console.error('Error actualizando estado local al cancelar:', error);
    }

    return NextResponse.json({ success: true, message: 'Suscripción cancelada' });
  } catch (error: any) {
    console.error('Error cancelando suscripción:', error);
    return NextResponse.json(
      { error: error.message || 'Error al cancelar la suscripción' },
      { status: 500 }
    );
  }
}
