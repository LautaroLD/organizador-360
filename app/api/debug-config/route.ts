import { NextResponse } from 'next/server';

export async function GET() {
  // Solo Lemon Squeezy (sin MercadoPago)
  const pk = process.env.NEXT_PUBLIC_LEMON_PUBLIC_KEY || '';

  return NextResponse.json({
    frontend_pk: pk.substring(0, 15) + '...',
    match: pk.startsWith('TEST-') ? 'TEST_MODE' : 'PRODUCTION',
    timestamp: new Date().toISOString(),
  });
}
