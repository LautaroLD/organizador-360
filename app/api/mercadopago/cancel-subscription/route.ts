import { createClient } from '@/lib/supabase/server';
import { preapproval } from '@/lib/mercadopago';
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

    // Obtener la suscripción activa
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('mercadopago_subscription_id, status, id')
      .eq('user_id', user.id)
      .in('status', ['active', 'authorized', 'trialing'])
      .single();

    if (!subscription || !subscription.mercadopago_subscription_id) {
      return NextResponse.json(
        { error: 'No se encontró una suscripción activa para cancelar' },
        { status: 404 }
      );
    }

    // Cancelar en Mercado Pago (Detiene futuros cobros)
    await preapproval.update({
      id: subscription.mercadopago_subscription_id,
      body: { status: 'cancelled' },
    });

    // Actualizar base de datos local
    // Establecemos cancel_at_period_end en true y mantenemos status en 'active'
    // Esto permite que el usuario siga accediendo hasta current_period_end
    const { error } = await supabase
      .from('subscriptions')
      .update({ 
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString()
        // Nota: NO cambiamos el status a 'cancelled' aquí. 
        // La función is_active_premium de la BD manejará el acceso basándose en current_period_end
      })
      .eq('id', subscription.id)
      .select();

    if (error) {
      console.error('Error actualizando estado local al cancelar:', error);
    }

    return NextResponse.json({ success: true, message: 'Suscripción cancelada' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error cancelando suscripción:', error);
    return NextResponse.json(
      { error: error.message || 'Error al cancelar la suscripción' },
      { status: 500 }
    );
  }
}
