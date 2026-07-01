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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();

    if (!user?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const subscriptionId = body.subscription_id;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'ID de suscripción requerido' },
        { status: 400 },
      );
    }

    // Verificar si la suscripción existe para el usuario
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('id, lemon_squeezy_subscription_id, user_id, status')
      .eq('lemon_squeezy_subscription_id', subscriptionId)
      .single();

    if (error || !subscription) {
      return NextResponse.json(
        { error: 'Suscripción no encontrada' },
        { status: 404 },
      );
    }

    // Verificar si la suscripción está cancelada
    const isCanceled = subscription.status === 'cancelled';

    if (!isCanceled) {
      return NextResponse.json(
        { error: 'La suscripción no está cancelada' },
        { status: 400 },
      );
    }

    // Verificar si el usuario es dueño de la suscripción (opcional, para seguridad adicional)
    if (subscription.user_id !== user.user.id) {
      return NextResponse.json(
        { error: 'No tienes permisos para reactivar esta suscripción' },
        { status: 403 },
      );
    }

    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'LEMON_SQUEEZY_API_KEY no está configurada' },
        { status: 500 },
      );
    }

    // Intentar reactivar la suscripción en Lemon Squeezy
    const lemonResponse = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`,
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
            id: String(subscriptionId),
            attributes: {
              cancelled: false,
            },
          },
        }),
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
        { error: `No se pudo reactivar en Lemon Squeezy: ${lemonError}` },
        { status: lemonResponse.status },
      );
    }

    // Obtener información actualizada de la suscripción
    const periodEnd =
      lemonPayload.data?.attributes?.renews_at ||
      lemonPayload.data?.attributes?.ends_at ||
      null;

    // Actualizar el registro local
    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        cancelled_at: null,
        current_period_end: periodEnd,
      })
      .eq('id', subscription.id);

    return NextResponse.json({
      success: true,
      message: 'Suscripción reactivada correctamente',
    });
  } catch (error) {
    console.error('Error reactivando suscripción Lemon Squeezy:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido';

    return NextResponse.json(
      {
        error:
          errorMessage || 'Error al reactivar suscripción de Lemon Squeezy',
      },
      { status: 500 },
    );
  }
}
