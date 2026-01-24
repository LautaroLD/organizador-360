import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/**
 * POST /api/mercadopago/cleanup-expired
 * Limpia suscripciones que fueron canceladas y cuyo período ya expiró
 * 
 * Este endpoint puede llamarse manualmente o programarse con un cron job
 */
export async function POST() {
  try {
    // Ejecutar la función de limpieza
    const { data, error } = await supabaseAdmin.rpc('cleanup_expired_subscriptions');

    if (error) {
      console.error('Error cleaning up expired subscriptions:', error);
      return NextResponse.json(
        { error: 'Error al limpiar suscripciones' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cleaned_count: data || 0,
      message: `${data || 0} suscripciones limpiadas exitosamente`,
    });
  } catch (error) {
    console.error('Error in cleanup endpoint:', error);
    return NextResponse.json(
      { error: 'Error al procesar solicitud' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mercadopago/cleanup-expired
 * Verifica cuántas suscripciones están expiradas sin limpiar
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, status, current_period_end, cancel_at_period_end')
      .in('status', ['active', 'trialing', 'past_due'])
      .eq('cancel_at_period_end', true)
      .lt('current_period_end', new Date().toISOString())
      .is('ended_at', null);

    if (error) {
      console.error('Error fetching expired subscriptions:', error);
      return NextResponse.json(
        { error: 'Error al obtener suscripciones' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      expired_count: data?.length || 0,
      subscriptions: data,
    });
  } catch (error) {
    console.error('Error in cleanup check:', error);
    return NextResponse.json(
      { error: 'Error al procesar solicitud' },
      { status: 500 }
    );
  }
}
