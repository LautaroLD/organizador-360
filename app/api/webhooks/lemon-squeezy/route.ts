import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { mapLemonStatusToDbStatus } from '@/lib/subscriptionUtils';
import { PlanTier } from '@/types/planTypes';

type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: {
      user_id?: string;
      user_email?: string;
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

type ResolvedPlan = {
  planId: string;
  planTier: PlanTier;
  variantId: string;
};

function safePeriodEnd(
  renewsAt?: string | null,
  endsAt?: string | null,
  trialEndsAt?: string | null,
  fallback?: string | null,
): string {
  const candidate = renewsAt ?? endsAt ?? trialEndsAt ?? fallback;
  if (candidate) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
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

function normalizeTier(code?: string | null): PlanTier {
  const normalized = code?.toLowerCase();
  if (normalized === 'starter' || normalized === 'pro') {
    return normalized;
  }
  return 'free';
}

async function resolvePlanByVariant(
  variantId?: string | number | null,
): Promise<ResolvedPlan | null> {
  if (variantId === null || variantId === undefined) {
    return null;
  }

  const normalizedVariantId = String(variantId).trim();
  if (!normalizedVariantId) {
    return null;
  }

  const { data, error } = await supabaseAdmin.rpc('get_plan_by_variant', {
    p_provider: 'lemon_squeezy',
    p_variant_id: normalizedVariantId,
  });

  if (error) {
    console.error('Error resolving plan by variant:', error);
    return null;
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  const payload = data as {
    plan_id?: string;
    code?: string;
  };

  if (!payload.plan_id) {
    return null;
  }

  const planTier = normalizeTier(payload.code);
  if (planTier === 'free') {
    return null;
  }

  return {
    planId: payload.plan_id,
    planTier,
    variantId: normalizedVariantId,
  };
}

function parseUserId(payload: LemonWebhookPayload): string | null {
  const userId = payload.meta?.custom_data?.user_id;
  if (
    typeof userId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      userId.trim(),
    )
  ) {
    return userId;
  }
  return null;
}

function parseEmailCandidate(payload: LemonWebhookPayload): string | null {
  const customUserId = payload.meta?.custom_data?.user_id;
  const customEmail = payload.meta?.custom_data?.user_email;
  const attributeEmail = payload.data?.attributes?.user_email;

  const candidate = [customEmail, attributeEmail, customUserId].find(
    (value) => {
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      return trimmed.includes('@');
    },
  );

  return typeof candidate === 'string' ? candidate.trim().toLowerCase() : null;
}

async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    console.error('Error resolving user_id by email:', error);
    return null;
  }

  return data?.id ?? null;
}

async function resolveUserIdWithFallback(
  payload: LemonWebhookPayload,
): Promise<string | null> {
  const userId = parseUserId(payload);
  if (userId) {
    return userId;
  }

  const emailCandidate = parseEmailCandidate(payload);
  if (emailCandidate) {
    const resolvedByEmail = await resolveUserIdByEmail(emailCandidate);
    if (resolvedByEmail) {
      return resolvedByEmail;
    }
  }

  const lemonSubscriptionId = payload.data?.id;
  if (!lemonSubscriptionId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('lemon_squeezy_subscription_id', String(lemonSubscriptionId))
    .maybeSingle();

  if (error) {
    console.error('Error resolving user_id by Lemon subscription id:', error);
    return null;
  }

  return data?.user_id ?? null;
}

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
  const userId = await resolveUserIdWithFallback(data);
  const lemonSubscriptionId = data.data?.id;
  const attributes = data.data?.attributes;

  console.log(`Event ${eventName} received for user ${userId ?? 'unknown'}`);

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
                'Webhook sin user_id resoluble o subscription_id. Configura custom_data.user_id en checkout.',
            },
            { status: 400 },
          );
        }

        const resolvedPlan = await resolvePlanByVariant(attributes.variant_id);
        if (!resolvedPlan) {
          console.error(
            `Unknown Lemon variant_id=${attributes.variant_id ?? 'null'} for subscription ${lemonSubscriptionId}`,
          );
          return NextResponse.json(
            {
              error:
                'variant_id desconocido. Verifica plan_provider_mappings.external_id.',
            },
            { status: 400 },
          );
        }

        const dbStatus =
          eventName === 'subscription_expired'
            ? 'cancelled'
            : mapLemonStatusToDbStatus(attributes.status);

        const { data: existingSubscription } = await supabaseAdmin
          .from('subscriptions')
          .select(
            'status, payment_provider, current_period_start, current_period_end',
          )
          .eq('user_id', userId)
          .maybeSingle();

        const currentPeriodStart = parseDateOrNow(attributes.updated_at);
        const currentPeriodEnd =
          eventName === 'subscription_expired'
            ? parseDateOrNow(
                attributes.ends_at ??
                  attributes.renews_at ??
                  attributes.trial_ends_at ??
                  attributes.updated_at ??
                  attributes.created_at,
              )
            : safePeriodEnd(
                attributes.renews_at,
                attributes.ends_at,
                attributes.trial_ends_at,
                existingSubscription?.current_period_end ?? null,
              );

        const cancelAtPeriodEnd =
          eventName === 'subscription_expired'
            ? false
            : attributes.cancelled === true ||
              eventName === 'subscription_cancelled';

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
            plan_tier: resolvedPlan.planTier,
            plan_id: resolvedPlan.planId,
            lemon_squeezy_variant_id: resolvedPlan.variantId,
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
          `Subscription ${lemonSubscriptionId} synced for user ${userId} (variant ${resolvedPlan.variantId} → ${resolvedPlan.planTier})`,
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
