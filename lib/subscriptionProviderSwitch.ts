type PaymentProvider = 'lemon_squeezy';

type ExistingSubscriptionSnapshot = {
  payment_provider?: string | null;
  status?: string | null;
  lemon_squeezy_subscription_id?: string | null;
};

function isCancelledStatus(status?: string | null): boolean {
  const normalized = status?.toLowerCase();
  return normalized === 'canceled' || normalized === 'cancelled';
}

function canCancelByStatus(status?: string | null): boolean {
  return !isCancelledStatus(status);
}

async function cancelLemonSqueezySubscription(subscriptionId: string) {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;

  if (!apiKey) {
    throw new Error('LEMON_SQUEEZY_API_KEY no está configurada');
  }

  const response = await fetch(
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
            cancelled: true,
          },
        },
      }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      errors?: Array<{ detail?: string; title?: string }>;
    } | null;

    const message =
      payload?.errors?.[0]?.detail ||
      payload?.errors?.[0]?.title ||
      `Lemon API ${response.status}`;

    throw new Error(message);
  }
}

export async function cancelPreviousProviderSubscription(input: {
  existingSubscription: ExistingSubscriptionSnapshot | null;
  targetProvider: PaymentProvider;
  userId: string;
}) {
  const { existingSubscription, targetProvider, userId } = input;

  if (!existingSubscription) return;

  const currentProvider = existingSubscription.payment_provider;

  if (!currentProvider || currentProvider === targetProvider) {
    return;
  }

  if (!canCancelByStatus(existingSubscription.status)) {
    return;
  }

  if (currentProvider === 'lemon_squeezy') {
    return;
  }

  if (
    currentProvider === 'lemon_squeezy' &&
    existingSubscription.lemon_squeezy_subscription_id
  ) {
    await cancelLemonSqueezySubscription(
      existingSubscription.lemon_squeezy_subscription_id,
    );
    return;
  }

  throw new Error(
    `No se pudo cancelar la suscripción previa del usuario ${userId}: proveedor o id inválido`,
  );
}
