import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/debug/premium-status
 * Diagnóstico de estado premium para el usuario autenticado
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // 1. Obtener datos de suscripción
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subError) {
      return NextResponse.json(
        { error: `Error al consultar subscriptions: ${subError.message}` },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json({
        user_id: user.id,
        subscription: null,
        is_active_premium: false,
        reason: 'No hay suscripción registrada para este usuario'
      });
    }

    // 2. Evaluar manualmente la condición de is_active_premium
    const now = new Date();
    const status = subscription.status;
    const canceledAt = subscription.canceled_at ? new Date(subscription.canceled_at) : null;
    const isPremiumStatus = ['active', 'trialing', 'past_due'].includes(status);
    const isCancelProgrammed = subscription.cancel_at_period_end === true;
    const isGracePeriodValid = !canceledAt || now < canceledAt;

    const isActivePremium = (isPremiumStatus || isCancelProgrammed) && isGracePeriodValid;

    // 3. Retornar diagnóstico completo
    return NextResponse.json({
      user_id: user.id,
      subscription: {
        id: subscription.id,
        status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at,
        current_period_end: subscription.current_period_end,
        current_period_start: subscription.current_period_start,
        created: subscription.created,
      },
      evaluation: {
        now: now.toISOString(),
        isPremiumStatus: isPremiumStatus ? `status es ${status}` : `status ${status} no es premium`,
        isCancelProgrammed: isCancelProgrammed ? 'cancelación programada' : 'sin cancelación programada',
        isGracePeriodValid: isGracePeriodValid
          ? canceledAt
            ? `gracia válida hasta ${canceledAt.toISOString()}`
            : 'sin fecha de fin de gracia'
          : `gracia expirada (canceled_at: ${canceledAt?.toISOString()})`,
      },
      is_active_premium: isActivePremium,
      reason: isActivePremium
        ? 'Usuario premium activo o en período de gracia'
        : 'Usuario no es premium o período de gracia expiró'
    });
  } catch (error) {
    console.error('Error en diagnóstico premium:', error);
    return NextResponse.json(
      { error: 'Error al procesar diagnóstico' },
      { status: 500 }
    );
  }
}
