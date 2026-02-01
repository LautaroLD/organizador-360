import { supabaseAdmin } from '@/lib/supabase/admin';
import { preapproval } from '@/lib/mercadopago'; // Importamos solo lo necesario
import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint para recibir notificaciones Webhook de Mercado Pago
 * Se debe configurar en el Dashboard de MP: https://www.mercadopago.com.ar/developers/panel
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let topic = searchParams.get('topic') || searchParams.get('type');
    let id = searchParams.get('id') || searchParams.get('data.id');

    // Intentar leer el body si viene como JSON
    try {
      const body = await request.json();
      if (body.type) topic = body.type;
      if (body.data && body.data.id) id = body.data.id;
      // Compatibilidad con diferentes formatos de notificación
      if (body.id) id = body.id;
    } catch {
      // Body vacío o no JSON, usamos query params (ignorar error 'e')
    }

    if (!id) {
       return NextResponse.json({ status: 'ignored', reason: 'no id provided' });
    }

    // Manejar actualizaciones de suscripción (preapproval)
    if (topic === 'subscription_preapproval') {
      const subscription = await preapproval.get({ id: id });
      
      const userId = subscription.external_reference;
      const status = subscription.status;

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

      // Mapear estado o usar directamente si la migración se aplicó
      // Estados MP: authorized, paused, cancelled, pending
      
      if (userId) {
        // Asegurar que userId sea un UUID válido antes de intentar upsert
        if (userId === 'NO_REF' || userId.length < 10) {
             console.warn('Webhook recibido sin External Reference válida (User ID). Ignorando upsert.', userId);
             return NextResponse.json({ status: 'ignored', reason: 'invalid_user_id' });
        }

        // Upsert para manejar tanto creación como actualización
        // Esto corrige el problema de "no carga como pro" si el checkout inicial falló en guardar la BD
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mpPlanId = (subscription as any).preapproval_plan_id as string | undefined;
        const planTier = getInternalPlanId(mpPlanId);

        const { error } = await supabaseAdmin
          .from('subscriptions')
          .upsert({
            id: subscription.id,
            mercadopago_subscription_id: subscription.id, // Redundante pero seguro
            user_id: userId,
            status: status,
            price_id: null, // No usamos price_id para MercadoPago
            plan_tier: planTier,
            current_period_end: subscription.next_payment_date ? new Date(subscription.next_payment_date).toISOString() : undefined,
            // Mantener fecha de creación original si existe, o usar now
          }, { onConflict: 'mercadopago_subscription_id' }); // O 'id' si es PK

        if (error) {
          console.error('Error actualizando suscripción via webhook:', error);
          return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
        }
      }
    }
    
    // Manejar eventos de pagos (cobros de las cuotas)
    if (topic === 'payment') {
       // Aquí podríamos verificar si el pago fue aprobado y actualizar fechas si fuera necesario,
       // pero generalmente 'subscription_preapproval' es la fuente de verdad del estado de la suscripción.
       // Sin embargo, si un pago falla, la suscripción podría entrar en 'retry' o similar.
    }

    return NextResponse.json({ status: 'ok' });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
   catch (error: any) {
    console.error('Error procesando webhook MP:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
