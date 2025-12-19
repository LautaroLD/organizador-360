import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/stripe/checkout
 * Crea una sesión de checkout en Stripe
 */
export async function POST(request: NextRequest) {
  try {
    const priceId = process.env.STRIPE_PRO_PLAN_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const stripeSecret = process.env.STRIPE_SECRET_KEY;

    if (!priceId || !appUrl || !stripeSecret) {
      console.error('Stripe checkout config missing', {
        hasPriceId: Boolean(priceId),
        hasAppUrl: Boolean(appUrl),
        hasStripeSecret: Boolean(stripeSecret),
      });
      return NextResponse.json(
        { error: 'Configuración de Stripe incompleta en el servidor' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Obtener datos del usuario de Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, name, id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si el usuario ya tiene un customer ID en Stripe
    let customerId: string;
    const { data: stripeData, error: stripeError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (stripeData?.stripe_customer_id) {
      customerId = stripeData.stripe_customer_id;
    } else {
      // Crear nuevo customer en Stripe
      const customer = await stripe.customers.create({
        email: userData.email || '',
        name: userData.name || '',
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;

      // Guardar customer ID en Supabase
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Crear sesión de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error en checkout:', error);
    return NextResponse.json(
      { error: 'Error al crear sesión de checkout' },
      { status: 500 }
    );
  }
}
