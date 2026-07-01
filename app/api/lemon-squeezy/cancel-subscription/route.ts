import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type LemonUpdateSubscriptionResponse = {
  data?: {
    id?: string;
    attributes?: {
      cancelled?: boolean;
      renews_at?: string | null;
      ends_at?: string | null;
      trial_ends_at?: string | null;
      status?: string;
    };
  };
  errors?: Array<{ detail?: string; title?: string }>;
};

export async function POST() {
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
      .select('id, lemon_squeezy_subscription_id, status, cancel_at_period_end')
      .eq('user_id', user.id)
      .eq('payment_provider', 'lemon_squeezy')
      .in('status', ['active', 'trialing', 'past_due'])
      .maybeSingle();

    if (!subscription || !subscription.lemon_squeezy_subscription_id) {
      return NextResponse.json(
        {
          error:
            'No se encontró una suscripción activa de Lemon Squeezy para cancelar',
        },
        { status: 404 },
      );
    }

    if (subscription.cancel_at_period_end) {
      return NextResponse.json({
        success: true,
        message:
          'La suscripción ya está programada para cancelarse al final del período.',
      });
    }

    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'LEMON_SQUEEZY_API_KEY no está configurada' },
        { status: 500 },
      );
    }

    const lemonResponse = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${subscription.lemon_squeezy_subscription_id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        },
        body: JSON.stringify({
          data: {
            type: 'subscriptions',
            id: String(subscription.lemon_squeezy_subscription_id),
            attributes: {
              cancelled: true,
            },
          },
        }),
        cache: 'no-store',
      },
    );

    const lemonPayload =
      (await lemonResponse.json()) as LemonUpdateSubscriptionResponse;

    if (!lemonResponse.ok) {
      const lemonError =
        lemonPayload?.errors?.[0]?.detail ||
        lemonPayload?.errors?.[0]?.title ||
        `Lemon API ${lemonResponse.status}`;

      return NextResponse.json(
        { error: `No se pudo cancelar en Lemon Squeezy: ${lemonError}` },
        { status: lemonResponse.status },
      );
    }

    const periodEnd =
      lemonPayload.data?.attributes?.renews_at ||
      lemonPayload.data?.attributes?.ends_at ||
      lemonPayload.data?.attributes?.trial_ends_at ||
      null;

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
        current_period_end: periodEnd,
      })
      .eq('id', subscription.id)
      .select();

    if (updateError) {
      console.error(
        'Error actualizando suscripción local tras cancelar en Lemon:',
        updateError,
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Suscripción cancelada. Finalizará al fin del período actual.',
    });
  } catch (error: unknown) {
    console.error('Error cancelando suscripción Lemon Squeezy:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido';

    return NextResponse.json(
      {
        error: errorMessage || 'Error al cancelar suscripción de Lemon Squeezy',
      },
      { status: 500 },
    );
  }
}
