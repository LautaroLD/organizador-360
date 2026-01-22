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
    } catch (e) {
      // Body vacío o no JSON, usamos query params
    }

    console.log('Webhook MP recibido:', { topic, id });

    if (!id) {
       return NextResponse.json({ status: 'ignored', reason: 'no id provided' });
    }

    // Manejar actualizaciones de suscripción (preapproval)
    if (topic === 'subscription_preapproval') {
      const subscription = await preapproval.get({ id: id });
      
      const userId = subscription.external_reference;
      const status = subscription.status;

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
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .upsert({
            id: subscription.id,
            mercadopago_subscription_id: subscription.id, // Redundante pero seguro
            user_id: userId,
            status: status,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            price_id: (subscription as any).preapproval_plan_id,
            current_period_end: subscription.next_payment_date ? new Date(subscription.next_payment_date).toISOString() : undefined,
            // Mantener fecha de creación original si existe, o usar now
            updated_at: new Date().toISOString() // Si tienes columna updated_at
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
       console.log('Pago recibido:', id);
    }

    return NextResponse.json({ status: 'ok' });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
   catch (error: any) {
    console.error('Error procesando webhook MP:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
