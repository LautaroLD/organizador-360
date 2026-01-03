import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import Stripe from 'stripe';

// GET /api/stripe/sync-session?session_id=cs_...
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id requerido' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Recuperar la sesión y la suscripción desde Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    });

    if (!session || !session.subscription) {
      return NextResponse.json({ error: 'Sesión sin suscripción' }, { status: 400 });
    }

    let subscription: Stripe.Subscription | null = session.subscription as Stripe.Subscription | null;
    // Fallback si es ID string
    if (typeof subscription === 'string') {
      try {
        subscription = await stripe.subscriptions.retrieve(subscription);
      } catch (e) {
        console.error('Failed to retrieve subscription by ID (sync-session):', e);
      }
    }
    const customerId: string | null = (session.customer as string) || null;

    let targetUserId: string | null = null;

    if (user) {
      targetUserId = user.id;
      // Sincroniza stripe_customer_id en el perfil si falta y tenemos customerId
      const { data: userRow } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single();

      if (!userRow?.stripe_customer_id && customerId) {
        await supabaseAdmin
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id);
      }
      // Si hay stripe_customer_id y no coincide con la sesión, prevenimos update para evitar desvíos
      if (userRow?.stripe_customer_id && customerId && userRow.stripe_customer_id !== customerId) {
        return NextResponse.json({ error: 'Customer no coincide con el usuario' }, { status: 403 });
      }
    } else if (customerId) {
      // Fallback sin autenticación: buscar usuario por customer id
      const { data: customerUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();
      targetUserId = customerUser?.id ?? null;
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'No se pudo determinar usuario' }, { status: 404 });
    }

    // Upsert Product and Price to satisfy FK constraints
    // Ensure price and product exist
    let price: Stripe.Price | undefined = subscription?.items?.data?.[0]?.price as Stripe.Price | undefined;
    if (typeof price === 'string') {
      try {
        price = await stripe.prices.retrieve(price, { expand: ['product'] });
      } catch (e) {
        console.error('Failed to retrieve price by ID (sync-session):', e);
      }
    }

    let productId: string | null = null;
    let productObj: Stripe.Product | null = null;
    const productRef = price?.product;
    if (typeof productRef === 'string') {
      try {
        const prod = await stripe.products.retrieve(productRef);
        productId = prod.id;
        productObj = prod;
      } catch (e) {
        console.error('Failed to retrieve product by ID (sync-session):', e);
        productId = productRef;
      }
    } else if (productRef && typeof productRef === 'object' && 'id' in productRef) {
      productId = productRef.id;
      productObj = productRef as Stripe.Product;
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
        console.error('Upsert product failed (sync-session):', upsertProductError);
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
        console.error('Upsert price failed (sync-session):', upsertPriceError);
      }
    } else if (typeof price === 'string') {
      // Fallback: garantizar existencia mínima del precio para cumplir FK
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
        console.error('Fallback upsert price failed (sync-session):', fallbackUpsertPriceError);
      }
    }

    // Upsert en Supabase (usar admin para evitar RLS)
    const { error: upsertError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          id: subscription.id,
          user_id: targetUserId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          price_id: typeof price === 'string' ? price : price?.id ?? null,
          current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
          current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: !!subscription.cancel_at_period_end,
          canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
          ended_at: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : null,
        },
        { onConflict: 'user_id' }
      );
    if (upsertError) {
      console.error('Upsert subscription failed (sync-session):', upsertError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sync-session:', error);
    return NextResponse.json({ error: 'Error al sincronizar sesión' }, { status: 500 });
  }
}
