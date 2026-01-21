import { NextResponse } from 'next/server';

export async function GET() {
  const pk = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || '';
  const at = process.env.MP_ACCESS_TOKEN || '';
  
  return NextResponse.json({
    frontend_pk: pk.substring(0, 15) + '...',
    backend_at: at.substring(0, 15) + '...',
    match: pk.startsWith('TEST-') && at.startsWith('TEST-') ? 'BOTH_TEST' : 'MISMATCH',
    timestamp: new Date().toISOString()
  });
}