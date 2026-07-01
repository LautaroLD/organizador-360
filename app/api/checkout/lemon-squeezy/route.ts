import { createClient } from '@/lib/supabase/server';
import { cancelPreviousProviderSubscription } from '@/lib/subscriptionProviderSwitch';
import { NextResponse } from 'next/server';

type LemonCheckoutBody = {
  planTier?: 'starter' | 'pro';
};

function getCheckoutBaseUrl(planTier: 'starter' | 'pro'): string | null {
  const key =
    planTier === 'starter'
      ? process.env.NEXT_PUBLIC_LEMON_STARTER_CHECKOUT_URL
      : process.env.NEXT_PUBLIC_LEMON_PRO_CHECKOUT_URL;

  return key?.trim() || null;
}

function getBaseAppUrl(request: Request): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (appUrl) return appUrl;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as LemonCheckoutBody;
    const planTier = body.planTier;

    if (planTier !== 'starter' && planTier !== 'pro') {
      return NextResponse.json(
        { error: 'planTier inválido. Debe ser starter o pro' },
        { status: 400 },
      );
    }

    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('payment_provider, status, lemon_squeezy_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle();

    await cancelPreviousProviderSubscription({
      existingSubscription,
      targetProvider: 'lemon_squeezy',
      userId: user.id,
    });

    const checkoutBaseUrl = getCheckoutBaseUrl(planTier);
    if (!checkoutBaseUrl) {
      return NextResponse.json(
        {
          error:
            'Checkout de Lemon Squeezy no configurado para este plan. Falta variable de entorno.',
        },
        { status: 500 },
      );
    }

    const baseUrl = getBaseAppUrl(request);
    const successUrl = `${baseUrl}/dashboard?subscription=success&provider=lemon_squeezy`;
    const cancelUrl = `${baseUrl}/dashboard?subscription=cancelled&provider=lemon_squeezy`;

    const checkoutUrl = new URL(checkoutBaseUrl);

    checkoutUrl.searchParams.set('checkout[email]', user.email ?? '');
    checkoutUrl.searchParams.set('checkout[custom][user_id]', user.id);
    checkoutUrl.searchParams.set('checkout[custom][plan_tier]', planTier);
    checkoutUrl.searchParams.set('checkout[success_url]', successUrl);
    checkoutUrl.searchParams.set('checkout[cancel_url]', cancelUrl);

    return NextResponse.json({ url: checkoutUrl.toString() });
  } catch (error: unknown) {
    console.error('Error creando checkout de Lemon Squeezy:', error);
    return NextResponse.json(
      { error: 'No se pudo iniciar checkout con Lemon Squeezy' },
      { status: 500 },
    );
  }
}
