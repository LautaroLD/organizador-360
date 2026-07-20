import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/lemon-squeezy/variant/[id]
 *
 * Precio/trial/buy_url live desde Lemon Variants API.
 * El catálogo de límites/features vive en /api/plans (DB).
 *
 * Importante: NO usar product.price_formatted — en productos multi-variant
 * Lemon devuelve un rango ("$10.00 - $12.00"). El precio unitario está en
 * variant.price (centavos, legado) o en price-model.unit_price.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Lemon Squeezy API key no configurada' },
      { status: 500 },
    );
  }

  try {
    const variantRes = await fetch(
      `https://api.lemonsqueezy.com/v1/variants/${id}?include=product`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/vnd.api+json',
        },
        next: { revalidate: 300 },
      },
    );

    if (!variantRes.ok) {
      return NextResponse.json(
        { error: 'Variant no encontrada' },
        { status: variantRes.status },
      );
    }

    const payload = await variantRes.json();
    const variant = payload?.data?.attributes;
    if (!variant) {
      return NextResponse.json({ error: 'Variant no encontrada' }, { status: 404 });
    }

    const includedProduct = Array.isArray(payload?.included)
      ? payload.included.find(
          (item: { type?: string }) => item.type === 'products',
        )
      : null;

    const productAttrs = includedProduct?.attributes ?? {};
    const name =
      (typeof variant.name === 'string' && variant.name) ||
      (typeof productAttrs.name === 'string' && productAttrs.name) ||
      'Plan';

    const priceCents = resolveVariantPriceCents(variant);
    const interval = normalizeInterval(variant.interval);
    const price = formatVariantPrice(priceCents, interval);

    const buyUrl =
      (typeof productAttrs.buy_now_url === 'string' && productAttrs.buy_now_url) ||
      undefined;

    return NextResponse.json({
      name,
      price,
      price_cents: priceCents,
      interval,
      buy_url: buyUrl,
      hasFreeTrial: Boolean(variant.has_free_trial),
      trialDays: Number(variant.trial_interval_count ?? 0),
      variant_id: String(id),
      product_id:
        variant.product_id != null ? String(variant.product_id) : undefined,
    });
  } catch {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }
}

function resolveVariantPriceCents(variant: Record<string, unknown>): number | null {
  const raw = variant.price;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return raw;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function normalizeInterval(value: unknown): 'month' | 'year' | null {
  if (value === 'month' || value === 'year') return value;
  return null;
}

function formatVariantPrice(
  priceCents: number | null,
  interval: 'month' | 'year' | null,
): string | undefined {
  if (priceCents === null) return undefined;

  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceCents / 100);

  if (interval === 'month') return `${amount}/mes`;
  if (interval === 'year') return `${amount}/año`;
  return amount;
}
