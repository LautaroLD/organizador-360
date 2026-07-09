import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  mapLemonStatusToDbStatus,
  mapLemonVariantIdToTier,
} from '@/lib/subscriptionUtils';
import { PlanTier } from '@/types/planTypes';

type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: {
      user_id?: string;
      plan_tier?: string;
    };
  };
  data?: {
    id?: string;
    attributes?: {
      status?: string;
      user_email?: string;
      customer_id?: number | string;
      order_id?: number | string;
      product_id?: number | string;
      variant_id?: number | string;
      renews_at?: string | null;
      ends_at?: string | null;
      trial_ends_at?: string | null;
      created_at?: string;
      updated_at?: string;
      cancelled?: boolean;
    };
  };
};

function safePeriodEnd(
  renewsAt?: string | null,
  endsAt?: string | null,
  trialEndsAt?: string | null,
): string {
  const candidate = renewsAt ?? endsAt ?? trialEndsAt;
  if (candidate) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
      return parsed.toISOString();
    }
  }

  const fallback = new Date();
  fallback.setMonth(fallback.getMonth() + 1);
  return fallback.toISOString();
}

function parseDateOrNow(value?: string | null): string {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

async function parseTier(
  payload: LemonWebhookPayload,
): Promise<'free' | 'starter' | 'pro'> {
  const fromCustomData = payload.meta?.custom_data?.plan_tier?.toLowerCase();
  if (fromCustomData === 'starter' || fromCustomData === 'pro') {
    return fromCustomData;
  }

  const variantId = payload.data?.attributes?.product_id;
  if (variantId !== null && variantId !== undefined) {
    const { data: catalogTier } = await supabaseAdmin.rpc(
      'resolve_plan_tier_by_provider',
      {
        p_provider: 'lemon_squeezy',
        p_external_id: String(variantId),
      },
    );

    if (catalogTier === 'starter' || catalogTier === 'pro') {
      return catalogTier;
    }
  }

  const mappedTier = mapLemonVariantIdToTier(variantId);
  return ['free', 'starter', 'pro'].includes(mappedTier)
    ? mappedTier
    : ('free' as PlanTier);
}

function parseUserId(payload: LemonWebhookPayload): string | null {
  const userId = payload.meta?.custom_data?.user_id;
  if (typeof userId === 'string' && userId.length > 10) {
    return userId;
  }
  return null;
}
async function getPlanIdByCode(code: string): Promise<string | null> {
  // 🦄 Ponytail: Naive cache-less lookup. Upgrade to Redis/LRU if hit rate is high.
  const { data, error } = await supabaseAdmin
    .from('plans')
    .select('id')
    .eq('code', code)
    .single();

  return error ? null : data.id;
}

// Self-check: Ensure function returns null for non-existent codes
// console.assert((await getPlanIdByCode('non-existent')) === null, 'Failed to handle missing code');
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 },
    );
  }

  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = hmac.update(body).digest('hex');

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8'),
    )
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const data = JSON.parse(body) as LemonWebhookPayload;
  const eventName = data.meta?.event_name || 'unknown_event';
  const userId = parseUserId(data);
  const lemonSubscriptionId = data.data?.id;
  const attributes = data.data?.attributes;

  console.log(`Event ${eventName} received for user ${userId ?? 'unknown'}`);

  // Manejar eventos de suscripción
  try {
    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_cancelled':
      case 'subscription_resumed':
      case 'subscription_expired': {
        if (!userId || !lemonSubscriptionId || !attributes) {
          return NextResponse.json(
            {
              error:
                'Webhook sin user_id o subscription_id. Configura custom_data.user_id en checkout.',
            },
            { status: 400 },
          );
        }

        const dbStatus = mapLemonStatusToDbStatus(attributes.status);
        const planTier = await parseTier(data);
        console.log(planTier);
        const planId = await getPlanIdByCode(planTier);
        console.log(planId, 'plan_id');

        const currentPeriodStart = parseDateOrNow(attributes.updated_at);
        const currentPeriodEnd = safePeriodEnd(
          attributes.renews_at,
          attributes.ends_at,
          attributes.trial_ends_at,
        );

        const cancelAtPeriodEnd =
          attributes.cancelled === true ||
          eventName === 'subscription_cancelled';

        const { data: existingSubscription } = await supabaseAdmin
          .from('subscriptions')
          .select('status, payment_provider, current_period_start')
          .eq('user_id', userId)
          .maybeSingle();

        const incomingTimestamp = new Date(
          attributes.created_at ?? attributes.updated_at ?? Date.now(),
        ).getTime();
        const existingTimestamp = existingSubscription?.current_period_start
          ? new Date(existingSubscription.current_period_start).getTime()
          : Number.NEGATIVE_INFINITY;

        if (
          existingSubscription?.payment_provider &&
          existingSubscription.payment_provider !== 'lemon_squeezy' &&
          Number.isFinite(incomingTimestamp) &&
          Number.isFinite(existingTimestamp) &&
          incomingTimestamp <= existingTimestamp
        ) {
          return NextResponse.json({
            received: true,
            ignored: true,
            reason: 'stale_cross_provider_event',
          });
        }

        const { error } = await supabaseAdmin.from('subscriptions').upsert(
          {
            user_id: userId,
            status: dbStatus,
            payment_provider: 'lemon_squeezy',
            plan_tier: planTier,
            lemon_squeezy_subscription_id: String(lemonSubscriptionId),
            lemon_squeezy_order_id: attributes.order_id
              ? String(attributes.order_id)
              : null,
            lemon_squeezy_customer_id: attributes.customer_id
              ? String(attributes.customer_id)
              : null,
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
            canceled_at: cancelAtPeriodEnd ? new Date().toISOString() : null,
            plan_id: planId,
          },
          { onConflict: 'user_id' },
        );

        if (error) {
          console.error('Error upserting Lemon Squeezy subscription:', error);
          return NextResponse.json(
            { error: 'No se pudo sincronizar la suscripción de Lemon' },
            { status: 500 },
          );
        }

        console.log(
          `Subscription ${lemonSubscriptionId} synced for user ${userId}`,
        );
        break;
      }

      default:
        console.log(`Unhandled event: ${eventName}`);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
