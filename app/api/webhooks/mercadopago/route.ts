import { supabaseAdmin } from '@/lib/supabase/admin';
import { preapproval } from '@/lib/mercadopago'; // Importamos solo lo necesario
import {
  mapMercadoPagoPlanIdToTier,
  mapMercadoPagoStatusToDbStatus,
} from '@/lib/subscriptionUtils';
import { NextRequest, NextResponse } from 'next/server';

function buildSafePeriodEnd(nextPaymentDate?: string | null): string {
  if (nextPaymentDate) {
    const parsed = new Date(nextPaymentDate);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
      return parsed.toISOString();
    }
  }

  const fallback = new Date();
  fallback.setMonth(fallback.getMonth() + 1);
  return fallback.toISOString();
}

/**
 * Endpoint para recibir notificaciones Webhook de Mercado Pago
 * Se debe configurar en el Dashboard de MP: https://www.mercadopago.com.ar/developers/panel
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let topic =
      searchParams.get('topic') ||
      searchParams.get('type') ||
      searchParams.get('action');
    let id = searchParams.get('id') || searchParams.get('data.id');

    // Intentar leer el body si viene como JSON
    try {
      const body = await request.json();
      if (body.type) topic = body.type;
      if (body.action) topic = body.action;
      if (body.data && body.data.id) id = body.data.id;
      // Compatibilidad con diferentes formatos de notificación
      if (body.id) id = body.id;
    } catch {
      // Body vacío o no JSON, usamos query params (ignorar error 'e')
    }

    if (!id) {
      return NextResponse.json({ status: 'ignored', reason: 'no id provided' });
    }

    const normalizedTopic = (topic || '').toLowerCase();
    const isSubscriptionEvent =
      normalizedTopic === 'subscription_preapproval' ||
      normalizedTopic === 'subscription_preapproval_created' ||
      normalizedTopic === 'subscription_preapproval_updated' ||
      normalizedTopic === 'preapproval';

    // Manejar actualizaciones de suscripción (preapproval)
    if (isSubscriptionEvent) {
      const subscription = await preapproval.get({ id: id });

      const externalReference = subscription.external_reference;
      const status = mapMercadoPagoStatusToDbStatus(subscription.status);

      // Mapear estado o usar directamente si la migración se aplicó
      // Estados MP: authorized, paused, cancelled, pending
      let userId = externalReference || null;

      if (!userId) {
        const { data: existingSub } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('mercadopago_subscription_id', subscription.id)
          .maybeSingle();

        userId = existingSub?.user_id ?? null;
      }

      if (!userId || userId === 'NO_REF' || userId.length < 10) {
        console.warn(
          'Webhook de suscripción sin user_id resoluble. Se omite upsert.',
          subscription.id,
        );
        return NextResponse.json({
          status: 'ignored',
          reason: 'invalid_user_id',
        });
      }

      // Upsert para manejar tanto creación como actualización
      // Esto corrige el problema de "no carga como pro" si el checkout inicial falló en guardar la BD
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mpPlanId = (subscription as any).preapproval_plan_id as
        | string
        | undefined;
      const planTier = mapMercadoPagoPlanIdToTier(mpPlanId, true);

      const { error } = await supabaseAdmin.from('subscriptions').upsert(
        {
          id: subscription.id,
          mercadopago_subscription_id: subscription.id,
          user_id: userId,
          status,
          price_id: null,
          plan_tier: planTier,
          current_period_start: subscription.date_created
            ? new Date(subscription.date_created).toISOString()
            : new Date().toISOString(),
          current_period_end: subscription.next_payment_date
            ? buildSafePeriodEnd(subscription.next_payment_date)
            : buildSafePeriodEnd(null),
          cancel_at_period_end: subscription.status === 'cancelled',
          canceled_at:
            subscription.status === 'cancelled'
              ? new Date().toISOString()
              : null,
        },
        { onConflict: 'user_id' },
      );

      if (error) {
        console.error('Error actualizando suscripción via webhook:', error);
        return NextResponse.json(
          { status: 'error', error: error.message },
          { status: 500 },
        );
      }
    }

    // Manejar eventos de pagos (cobros de las cuotas)
    if (normalizedTopic === 'payment') {
      // Aquí podríamos verificar si el pago fue aprobado y actualizar fechas si fuera necesario,
      // pero generalmente 'subscription_preapproval' es la fuente de verdad del estado de la suscripción.
      // Sin embargo, si un pago falla, la suscripción podría entrar en 'retry' o similar.
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error: unknown) {
    console.error('Error procesando webhook MP:', error);
    const message =
      error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
