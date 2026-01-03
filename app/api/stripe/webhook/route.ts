import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

/**
 * POST /api/stripe/webhook
 * Maneja eventos de Stripe
 */
export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json(
      { error: 'Firma de webhook faltante' },
      { status: 400 }
    );
  }

  try {
    const body = await request.text();
    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Obtener datos del usuario por customer ID
        const { data: customerData } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!customerData) {
          console.error('Usuario no encontrado para customer:', customerId);
          break;
        }

        const userId = customerData.id;

        // Actualizar estado de suscripción en Supabase
        const status = subscription.status; // usa el estado de Stripe tal cual para cumplir el CHECK
        const currentPeriodEnd = new Date(
          subscription.current_period_end * 1000
        ).toISOString();

        // Upsert Product and Price to satisfy FK constraints
        // Ensure price and product exist in DB to satisfy FKs
        let price = subscription.items.data[0].price as Stripe.Price | string;
        if (typeof price === 'string') {
          try {
            price = await stripe.prices.retrieve(price, { expand: ['product'] });
          } catch (e) {
            console.error('Failed to retrieve price by ID (webhook):', e);
          }
        }

        let productId: string | null = null;
        let productObj: Stripe.Product | null = null;
        const productRef = (price as Stripe.Price)?.product as Stripe.Product | string | undefined;
        if (typeof productRef === 'string') {
          try {
            const prod = await stripe.products.retrieve(productRef);
            productId = prod.id;
            productObj = prod;
          } catch (e) {
            console.error('Failed to retrieve product by ID (webhook):', e);
            productId = productRef; // fallback to ID
          }
        } else if (productRef && 'id' in productRef) {
          productId = (productRef as Stripe.Product).id;
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
            console.error('Upsert product failed (webhook):', upsertProductError);
          }
        }

        if (typeof price !== 'string') {
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
            console.error('Upsert price failed (webhook):', upsertPriceError);
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
            console.error('Fallback upsert price failed (webhook):', fallbackUpsertPriceError);
          }
        }

        await supabaseAdmin
          .from('subscriptions')
          .upsert(
            {
              id: subscription.id,
              user_id: userId,
              stripe_subscription_id: subscription.id,
              status,
               price_id: typeof price === 'string' ? price : price?.id ?? null,
              current_period_start: new Date(
                subscription.current_period_start * 1000
              ).toISOString(),
              current_period_end: currentPeriodEnd,
              cancel_at_period_end: subscription.cancel_at_period_end,
              canceled_at: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000).toISOString()
                : null,
              ended_at: subscription.ended_at
                ? new Date(subscription.ended_at * 1000).toISOString()
                : null,
            },
            { onConflict: 'user_id' }
          );

        console.log(`Suscripción ${status} para usuario ${userId}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: customerData } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (customerData) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'canceled',
              ended_at: new Date().toISOString(),
            })
            .eq('user_id', customerData.id);

          console.log(`Suscripción cancelada para usuario ${customerData.id}`);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: customerData } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (customerData) {
          console.log(`Pago recibido para usuario ${customerData.id}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: customerData } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (customerData) {
          console.error(
            `Pago fallido para usuario ${customerData.id}:`,
            invoice.last_finalization_error
          );
        }
        break;
      }

      default:
        console.log(`Evento no manejado: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error en webhook:', error);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }
}
