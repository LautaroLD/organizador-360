import { createClient } from '@/lib/supabase/server';
import { resolveEffectivePlanTier } from '@/lib/subscriptionUtils';
import { NextResponse } from 'next/server';

type LemonSubscriptionAttributes = {
  status?: string;
  created_at?: string;
  updated_at?: string;
  renews_at?: string | null;
  ends_at?: string | null;
  trial_ends_at?: string | null;
  cancelled?: boolean;
  product_name?: string;
  variant_name?: string;
  card_brand?: string | null;
  card_last_four?: string | null;
  user_email?: string;
  customer_portal_url?: string | null;
  customer_portal_update_subscription?: string | null;
  urls?: {
    customer_portal?: string;
    update_payment_method?: string;
    customer_portal_update_subscription?: string;
  };
};

type LemonSubscriptionResponse = {
  data?: {
    id?: string;
    attributes?: LemonSubscriptionAttributes;
  };
};

function getLemonStatusLabel(status?: string): string {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return 'Activa';
    case 'on_trial':
      return 'En prueba';
    case 'paused':
      return 'Pausada';
    case 'past_due':
      return 'Pago atrasado';
    case 'cancelled':
      return 'Cancelada';
    case 'expired':
      return 'Expirada';
    default:
      return status || 'Desconocido';
  }
}

function getLemonStatusColor(status?: string): string {
  switch ((status || '').toLowerCase()) {
    case 'active':
    case 'on_trial':
      return 'green';
    case 'paused':
    case 'past_due':
      return 'orange';
    case 'cancelled':
    case 'expired':
      return 'red';
    default:
      return 'gray';
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('payment_provider', 'lemon_squeezy')
      .maybeSingle();

    if (!subscription || !subscription.lemon_squeezy_subscription_id) {
      return NextResponse.json({
        hasSubscription: false,
        source: null,
        details: null,
      });
    }

    const internalPlanId = resolveEffectivePlanTier({
      planTier: subscription.plan_tier,
    });

    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        hasSubscription: true,
        isPro: internalPlanId === 'pro',
        internalPlanId,
        source: 'database',
        details: {
          id: subscription.lemon_squeezy_subscription_id,
          status: subscription.status,
          statusLabel: getLemonStatusLabel(subscription.status ?? undefined),
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          provider: 'lemon_squeezy',
        },
        error: 'LEMON_SQUEEZY_API_KEY no está configurada',
      });
    }

    try {
      const response = await fetch(
        `https://api.lemonsqueezy.com/v1/subscriptions/${subscription.lemon_squeezy_subscription_id}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
          },
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        throw new Error(`Lemon API ${response.status}`);
      }

      const payload = (await response.json()) as LemonSubscriptionResponse;

      const lsSubscription = payload.data;

      const attributes = lsSubscription?.attributes;

      const details = {
        id: lsSubscription?.id ?? subscription.lemon_squeezy_subscription_id,
        status: attributes?.status ?? subscription.status,
        statusLabel: getLemonStatusLabel(
          attributes?.status ?? subscription.status,
        ),
        statusColor: getLemonStatusColor(
          attributes?.status ?? subscription.status,
        ),
        dateCreated: attributes?.created_at ?? null,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd:
          attributes?.renews_at ??
          attributes?.ends_at ??
          attributes?.trial_ends_at ??
          subscription.current_period_end,
        renewsAt: attributes?.renews_at ?? null,
        endsAt: attributes?.ends_at ?? null,
        trialEndsAt: attributes?.trial_ends_at ?? null,
        cancelAtPeriodEnd:
          attributes?.cancelled ?? subscription.cancel_at_period_end ?? false,
        productName: attributes?.product_name ?? null,
        variantName: attributes?.variant_name ?? null,
        userEmail: attributes?.user_email ?? user.email ?? null,
        paymentMethod:
          attributes?.card_brand && attributes?.card_last_four
            ? `${attributes.card_brand.toUpperCase()} ****${attributes.card_last_four}`
            : null,
        customerPortalUrl:
          attributes?.customer_portal_url ??
          attributes?.urls?.customer_portal ??
          null,
        updatePaymentMethodUrl: attributes?.urls?.update_payment_method ?? null,
        updateSubscriptionUrl:
          attributes?.customer_portal_update_subscription ??
          attributes?.urls?.customer_portal_update_subscription ??
          null,
        provider: 'lemon_squeezy',
      };

      return NextResponse.json({
        hasSubscription: true,
        isPro: internalPlanId === 'pro',
        internalPlanId,
        source: 'lemon_squeezy',
        details,
      });
    } catch (lemonError) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(
          'Error obteniendo suscripción de Lemon Squeezy:',
          lemonError,
        );
      }

      return NextResponse.json({
        hasSubscription: true,
        isPro: internalPlanId === 'pro',
        internalPlanId,
        source: 'database',
        details: {
          id: subscription.lemon_squeezy_subscription_id,
          status: subscription.status,
          statusLabel: getLemonStatusLabel(subscription.status ?? undefined),
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          provider: 'lemon_squeezy',
        },
        error: 'No se pudo obtener información actualizada de Lemon Squeezy',
      });
    }
  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error obteniendo detalles de suscripción Lemon:', error);
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
