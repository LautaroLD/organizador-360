import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  Reques: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const api_key = process.env.LEMON_SQUEEZY_API_KEY;

  try {
    const product = await fetch(
      `https://api.lemonsqueezy.com/v1/products/${id}?include=variants`,
      {
        headers: {
          Authorization: `Bearer ${api_key}`,
        },
      },
    );
    const data = await product.json();
    const attributes = data.data.attributes;
    const variant = data.included[0].attributes;
    const result = {
      name: attributes.name,
      price: attributes.price_formatted,
      buy_url: attributes.buy_now_url,
      hasFreeTrial: variant.has_free_trial,
      trialDays: variant.trial_interval_count,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'No encontrado' });
  }
}
