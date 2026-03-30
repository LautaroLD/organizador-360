import { createClient } from '@/lib/supabase/server';
import { preapproval } from '@/lib/mercadopago';
import {
  mapMercadoPagoPlanIdToTier,
  mapMercadoPagoStatusToDbStatus,
} from '@/lib/subscriptionUtils';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

type CheckoutBody = {
  cardTokenId?: string;
  payerEmail?: string;
  planId?: string;
};

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

function isTestUserEmail(email: string): boolean {
  const normalized = email.toLowerCase();
  return (
    normalized.includes('testuser') ||
    /^test_user_\d+@testuser\.com$/i.test(email)
  );
}

function normalizeSandboxPayerEmail(email: string): string {
  const trimmed = email.trim();

  if (trimmed.includes('@')) {
    return trimmed;
  }

  if (/^testuser\d+$/i.test(trimmed)) {
    return `${trimmed}@testuser.com`;
  }

  return trimmed;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as CheckoutBody;
    const planId = body.planId?.trim();
    const cardTokenId = body.cardTokenId?.trim();
    const requestedPayerEmail = body.payerEmail?.trim() || user.email;
    const sandboxMode = process.env.MP_SANDBOX_MODE === 'true';
    const configuredTestPayerEmail = process.env.MP_TEST_PAYER_EMAIL?.trim();
    const rawPayerEmail = sandboxMode
      ? configuredTestPayerEmail || requestedPayerEmail
      : requestedPayerEmail;
    const payerEmail = sandboxMode
      ? normalizeSandboxPayerEmail(rawPayerEmail)
      : rawPayerEmail;

    if (!planId) {
      return NextResponse.json(
        { error: 'planId es obligatorio' },
        { status: 400 },
      );
    }

    if (!cardTokenId) {
      return NextResponse.json(
        { error: 'cardTokenId es obligatorio' },
        { status: 400 },
      );
    }

    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Configuración de Mercado Pago incompleta' },
        { status: 500 },
      );
    }

    if (sandboxMode && !isTestUserEmail(payerEmail)) {
      return NextResponse.json(
        {
          error:
            'En modo sandbox, el payer_email debe ser de test user. Puedes usar TESTUSER... (se normaliza) o un email @testuser.com.',
        },
        { status: 400 },
      );
    }

    const planRes = await fetch(
      `https://api.mercadopago.com/preapproval_plan/${planId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!planRes.ok) {
      return NextResponse.json(
        { error: 'Plan de Mercado Pago inválido o no disponible' },
        { status: 400 },
      );
    }

    const plan = (await planRes.json()) as { reason?: string };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
    const fallbackUrl = new URL(request.url).origin;
    const baseUrl = appUrl || fallbackUrl;

    const { data: existingSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('mercadopago_subscription_id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    const previousSubscriptionId =
      existingSubscription?.mercadopago_subscription_id ?? null;
    const previousStatus = existingSubscription?.status?.toLowerCase();

    if (
      previousSubscriptionId &&
      previousStatus !== 'cancelled' &&
      previousStatus !== 'canceled'
    ) {
      try {
        await preapproval.update({
          id: previousSubscriptionId,
          body: { status: 'cancelled' },
        });
      } catch (cancelPreviousError) {
        console.warn(
          'No se pudo cancelar la suscripción previa en Mercado Pago:',
          previousSubscriptionId,
          cancelPreviousError,
        );
      }
    }

    const createdSubscription = await preapproval.create({
      body: {
        preapproval_plan_id: planId,
        payer_email: payerEmail,
        card_token_id: cardTokenId,
        external_reference: user.id,
        status: 'authorized',
        reason: plan.reason ?? 'Suscripción',
        back_url: `${baseUrl}/dashboard`,
        // notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      },
    });

    const dbStatus = mapMercadoPagoStatusToDbStatus(createdSubscription.status);
    const nowIso = new Date().toISOString();
    const nextPaymentDate = buildSafePeriodEnd(
      createdSubscription.next_payment_date,
    );
    const planTier = mapMercadoPagoPlanIdToTier(planId, true);

    const { error: upsertError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          id: createdSubscription.id,
          user_id: user.id,
          mercadopago_subscription_id: createdSubscription.id,
          status: dbStatus,
          price_id: null,
          plan_tier: planTier,
          current_period_start: createdSubscription.date_created ?? nowIso,
          current_period_end: nextPaymentDate,
          cancel_at_period_end: false,
          canceled_at: null,
        },
        { onConflict: 'user_id' },
      );

    if (upsertError) {
      console.error(
        'Error guardando suscripción luego del checkout:',
        upsertError,
      );
      return NextResponse.json(
        {
          error:
            'La suscripción fue creada en Mercado Pago pero no se pudo persistir localmente',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      id: createdSubscription.id,
      status: createdSubscription.status,
      syncRecommended: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error procesando checkout de suscripción:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar la suscripción' },
      { status: 500 },
    );
  }
}
