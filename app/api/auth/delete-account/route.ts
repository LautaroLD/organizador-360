import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

async function cancelLemonSubscriptionForUser(userId: string) {
  const { data: subscription, error } = await supabaseAdmin
    .from('subscriptions')
    .select('lemon_squeezy_subscription_id, payment_provider, status')
    .eq('user_id', userId)
    .eq('payment_provider', 'lemon_squeezy')
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo obtener la suscripción: ${error.message}`);
  }

  if (!subscription?.lemon_squeezy_subscription_id) {
    return;
  }

  const normalizedStatus = (subscription.status ?? '').toLowerCase();
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'expired') {
    return;
  }

  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error('LEMON_SQUEEZY_API_KEY no está configurada');
  }

  const response = await fetch(
    `https://api.lemonsqueezy.com/v1/subscriptions/${subscription.lemon_squeezy_subscription_id}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json',
      },
      cache: 'no-store',
    },
  );

  // 404: la suscripción ya no existe en Lemon (la tratamos como cancelada).
  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    throw new Error(
      `Lemon Squeezy respondió ${response.status} al cancelar la suscripción`,
    );
  }
}

export async function DELETE() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const { session } = data;

  if (!session || !session.user) {
    return new Response(
      JSON.stringify({ error: 'No authenticated user found' }),
      {
        status: 401,
      },
    );
  }

  try {
    await cancelLemonSubscriptionForUser(session.user.id);
  } catch (cancelError) {
    const message =
      cancelError instanceof Error
        ? cancelError.message
        : 'No se pudo cancelar la suscripción de Lemon Squeezy';

    return new Response(JSON.stringify({ error: message }), { status: 502 });
  }

  const { error: fetchError } = await supabaseAdmin.auth.admin.deleteUser(
    session.user.id,
  );
  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
    });
  }

  return new Response(
    JSON.stringify({ message: 'User account deleted successfully' }),
    { status: 200 },
  );
}
