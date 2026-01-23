import { createClient } from '@/lib/supabase/server';
import { preapproval } from '@/lib/mercadopago';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/mercadopago/sync-preapproval?preapproval_id=xxx
 * 
 * Sincroniza una suscripción de MercadoPago después de que el usuario
 * completa el checkout y es redirigido de vuelta a la app.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const preapprovalId = searchParams.get('preapproval_id');

    if (!preapprovalId) {
      return NextResponse.json(
        { error: 'preapproval_id requerido' },
        { status: 400 }
      );
    }

    // Verificar usuario autenticado
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Obtener datos de la suscripción desde MercadoPago
    const mpSubscription = await preapproval.get({ id: preapprovalId });

    if (!mpSubscription) {
      return NextResponse.json(
        { error: 'Suscripción no encontrada en MercadoPago' },
        { status: 404 }
      );
    }

    // Mapear estado de MP a estados permitidos en nuestra BD
    // Estados de MP: pending, authorized, paused, cancelled
    // Estados en nuestra BD: active, canceled, past_due, trialing, incomplete, etc.
    let dbStatus = 'active';
    switch (mpSubscription.status) {
      case 'authorized':
        dbStatus = 'active';
        break;
      case 'pending':
        dbStatus = 'incomplete';
        break;
      case 'paused':
        dbStatus = 'paused';
        break;
      case 'cancelled':
        dbStatus = 'canceled';
        break;
      default:
        dbStatus = mpSubscription.status || 'active';
    }

    // Calcular fechas
    const now = new Date();
    const nextPaymentDate = mpSubscription.next_payment_date 
      ? new Date(mpSubscription.next_payment_date)
      : new Date(now.setMonth(now.getMonth() + 1));

    // Nota: No guardamos el preapproval_plan_id en price_id porque tiene FK a tabla prices (Stripe)
    // El plan de MP se guarda implícitamente via mercadopago_subscription_id

    // Upsert en la tabla de subscriptions
    const { error: upsertError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          id: preapprovalId,
          user_id: user.id,
          mercadopago_subscription_id: preapprovalId,
          status: dbStatus,
          price_id: null, // No usamos price_id para MercadoPago (FK a prices de Stripe)
          current_period_start: mpSubscription.date_created || new Date().toISOString(),
          current_period_end: nextPaymentDate.toISOString(),
          cancel_at_period_end: false,
          canceled_at: mpSubscription.status === 'cancelled' ? new Date().toISOString() : null,
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('[SYNC] Error guardando suscripción:', upsertError);
      return NextResponse.json(
        { error: 'Error guardando suscripción' },
        { status: 500 }
      );
    }

    console.log('[SYNC] Suscripción sincronizada exitosamente');

    return NextResponse.json({
      success: true,
      subscription: {
        id: preapprovalId,
        status: dbStatus,
      }
    });

  } catch (error: unknown) {
    console.error('[SYNC] Error sincronizando preapproval:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
