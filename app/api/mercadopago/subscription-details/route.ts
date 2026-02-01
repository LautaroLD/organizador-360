import { createClient } from '@/lib/supabase/server';
import { preapproval } from '@/lib/mercadopago';
import { NextResponse } from 'next/server';

/**
 * GET /api/mercadopago/subscription-details
 * 
 * Obtiene los detalles completos de la suscripción de MercadoPago del usuario actual.
 */
export async function GET() {
  try {
    // Verificar usuario autenticado
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Obtener la suscripción del usuario de la BD
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!subscription || !subscription.mercadopago_subscription_id) {
      return NextResponse.json({
        hasSubscription: false,
        source: null,
        details: null
      });
    }

    const planIdMap: Record<string, string[]> = {
      starter: [
        process.env.MP_STARTER_MENSUAL_PLAN_ID ?? process.env.NEXT_PUBLIC_MP_STARTER_MENSUAL_PLAN_ID ?? '',
        process.env.MP_STARTER_ANUAL_PLAN_ID ?? process.env.NEXT_PUBLIC_MP_STARTER_ANUAL_PLAN_ID ?? ''
      ],
      pro: [
        process.env.MP_PRO_MENSUAL_PLAN_ID ?? process.env.NEXT_PUBLIC_MP_PRO_MENSUAL_PLAN_ID ?? '',
        process.env.MP_PRO_ANUAL_PLAN_ID ?? process.env.NEXT_PUBLIC_MP_PRO_ANUAL_PLAN_ID ?? ''
      ],
      enterprise: [
        process.env.MP_ENTERPRISE_MENSUAL_PLAN_ID ?? process.env.NEXT_PUBLIC_MP_ENTERPRISE_MENSUAL_PLAN_ID ?? '',
        process.env.MP_ENTERPRISE_ANUAL_PLAN_ID ?? process.env.NEXT_PUBLIC_MP_ENTERPRISE_ANUAL_PLAN_ID ?? ''
      ],
    };

    const getInternalPlanId = (planId?: string | null) => {
      if (!planId) return 'free';
      if (planIdMap.starter.includes(planId)) return 'starter';
      if (planIdMap.pro.includes(planId)) return 'pro';
      if (planIdMap.enterprise.includes(planId)) return 'enterprise';
      return 'free';
    };

    // Obtener detalles de MercadoPago
    try {
      const mpSubscription = await preapproval.get({ 
        id: subscription.mercadopago_subscription_id 
      });

      let statusLabel = 'Desconocido';
      let statusColor = 'gray';
      
      switch (mpSubscription.status) {
        case 'authorized':
          statusLabel = 'Activa';
          statusColor = 'green';
          break;
        case 'pending':
          statusLabel = 'Pendiente de pago';
          statusColor = 'yellow';
          break;
        case 'paused':
          statusLabel = 'Pausada';
          statusColor = 'orange';
          break;
        case 'cancelled':
          statusLabel = 'Cancelada';
          statusColor = 'red';
          break;
      }

      // Calcular días restantes del período
      const now = new Date();
      const nextPayment = mpSubscription.next_payment_date 
        ? new Date(mpSubscription.next_payment_date)
        : null;

      let daysUntilNextPayment = null;
      if (nextPayment) {
        daysUntilNextPayment = Math.ceil((nextPayment.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Definir variables faltantes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const autoRecurring = mpSubscription.auto_recurring as any;
      const endDate = autoRecurring?.end_date 
        ? new Date(autoRecurring.end_date) 
        : null;

      let daysUntilEnd = null;
      if (endDate) {
        daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      const isExpired = mpSubscription.status === 'cancelled' || (!!endDate && endDate < now);

      const mpDetails = {
          id: mpSubscription.id,
          status: mpSubscription.status,
          statusLabel,
          statusColor,
          reason: mpSubscription.reason,
          
          // Fechas importantes
          dateCreated: mpSubscription.date_created,
          nextPaymentDate: mpSubscription.next_payment_date,
          startDate: autoRecurring?.start_date,
          endDate: autoRecurring?.end_date,
          
          // Información de pago
          amount: autoRecurring?.transaction_amount,
          currency: autoRecurring?.currency_id,
          frequency: autoRecurring?.frequency,
          frequencyType: autoRecurring?.frequency_type,
          
          // Trial/Free period
          hasFreeTrial: !!autoRecurring?.free_trial,
          freeTrialDays: autoRecurring?.free_trial?.first_invoice_offset || 0,
          
          // Resumen de pagos
          chargedQuantity: mpSubscription.summarized?.charged_quantity || 0,
          pendingChargeQuantity: mpSubscription.summarized?.pending_charge_quantity || 0,
          totalChargedAmount: mpSubscription.summarized?.charged_amount || 0,
          lastChargedDate: mpSubscription.summarized?.last_charged_date,
          
          // Método de pago
          paymentMethodId: mpSubscription.payment_method_id,
          
          // Calculados
          daysUntilNextPayment,
          daysUntilEnd,
          isExpired,
          isActive: mpSubscription.status === 'authorized',
          isCancelled: mpSubscription.status === 'cancelled',
          isPaused: mpSubscription.status === 'paused',
          isPending: mpSubscription.status === 'pending',
      };

      // DETERMINAR PLAN (Lógica del Servidor)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscriptionPlanId = (mpSubscription as any).preapproval_plan_id as string | undefined;
      const internalPlanId = getInternalPlanId(subscriptionPlanId);

      return NextResponse.json({
        hasSubscription: true,
        isPro: internalPlanId === 'pro' || internalPlanId === 'enterprise',
        internalPlanId,
        source: 'mercadopago',
        details: mpDetails
      });

      } catch (mpError) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error obteniendo suscripción de MP:', mpError);
      }
      
      // Devolver datos de la BD si no podemos obtener de MP
      
      const internalPlanId = subscription.plan_tier ? subscription.plan_tier : getInternalPlanId(subscription.price_id);

      return NextResponse.json({
        hasSubscription: true,
        isPro: internalPlanId === 'pro' || internalPlanId === 'enterprise',
        internalPlanId,
        source: 'database',
        details: {
          id: subscription.mercadopago_subscription_id,
          status: subscription.status,
          statusLabel: subscription.status === 'active' ? 'Activa' : subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
        error: 'No se pudo obtener información actualizada de MercadoPago'
      });
    }

  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error obteniendo detalles de suscripción:', error);
    }
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
