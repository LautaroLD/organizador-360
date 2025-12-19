import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/stripe/cancel-subscription
 * Cancela la suscripción del usuario
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Obtener ID de suscripción de Stripe
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .single();

    if (error || !subscription?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No tienes una suscripción activa' },
        { status: 404 }
      );
    }

    // Cancelar suscripción en Stripe (al final del período)
    const canceled = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      }
    );

    // Expandir price/product y sincronizar en Supabase para reflejar cancelación programada
    let stripeSub = canceled;
    try {
      stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
        expand: ['items.data.price.product']
      });
    } catch (e) {
      // si falla, seguimos con el objeto devuelto por update
      console.error('No se pudo expandir la suscripción tras cancelación:', e);
    }

    // Asegurar existencia de product/price para FK
    let price: any = stripeSub.items?.data?.[0]?.price;
    if (typeof price === 'string') {
      try {
        price = await stripe.prices.retrieve(price, { expand: ['product'] });
      } catch (e) {
        console.error('Fallo al recuperar price tras cancelación:', e);
      }
    }

    let productId: string | null = null;
    let productObj: any = null;
    const productRef = price?.product;
    if (typeof productRef === 'string') {
      try {
        const prod = await stripe.products.retrieve(productRef);
        productId = prod.id;
        productObj = prod;
      } catch (e) {
        console.error('Fallo al recuperar product tras cancelación:', e);
        productId = productRef; // fallback sólo ID
      }
    } else if (productRef && productRef.id) {
      productId = productRef.id;
      productObj = productRef;
    }

    if (productId) {
      const { error: upsertProductError } = await supabaseAdmin
        .from('products')
        .upsert({
          id: productId,
          active: productObj?.active ?? true,
          name: productObj?.name ?? 'Pro Plan',
          description: productObj?.description ?? null,
          image: null,
          metadata: productObj?.metadata ?? null,
        }, { onConflict: 'id' });
      if (upsertProductError) {
        console.error('Upsert product tras cancelación falló:', upsertProductError);
      }
    }

    if (price && typeof price !== 'string') {
      const { error: upsertPriceError } = await supabaseAdmin
        .from('prices')
        .upsert({
          id: price.id,
          product_id: productId ?? null,
          active: price.active ?? true,
          description: price.nickname ?? null,
          unit_amount: price.unit_amount ?? null,
          currency: price.currency,
          type: price.type,
          interval: price.recurring?.interval ?? null,
          interval_count: price.recurring?.interval_count ?? null,
          metadata: price.metadata ?? null,
        }, { onConflict: 'id' });
      if (upsertPriceError) {
        console.error('Upsert price tras cancelación falló:', upsertPriceError);
      }
    } else if (typeof price === 'string') {
      const { error: fallbackUpsertPriceError } = await supabaseAdmin
        .from('prices')
        .upsert({
          id: price,
          product_id: productId ?? null,
          active: true,
          description: null,
          unit_amount: null,
          currency: null,
          type: null,
          interval: null,
          interval_count: null,
          metadata: null,
        }, { onConflict: 'id' });
      if (fallbackUpsertPriceError) {
        console.error('Fallback upsert price tras cancelación falló:', fallbackUpsertPriceError);
      }
    }

    const status = stripeSub.status;
    const currentPeriodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();

    await supabaseAdmin
      .from('subscriptions')
      .upsert({
        id: stripeSub.id,
        user_id: user.id,
        stripe_subscription_id: stripeSub.id,
        status,
        price_id: typeof price === 'string' ? price : price?.id ?? null,
        current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: true,
        canceled_at: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000).toISOString() : null,
        ended_at: stripeSub.ended_at ? new Date(stripeSub.ended_at * 1000).toISOString() : null,
      }, { onConflict: 'user_id' });

    return NextResponse.json({ success: true, status, cancel_at_period_end: true });
  } catch (error) {
    console.error('Error cancelando suscripción:', error);
    return NextResponse.json(
      { error: 'Error al cancelar suscripción' },
      { status: 500 }
    );
  }
}
