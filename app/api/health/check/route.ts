import { NextResponse } from 'next/server';

export async function GET() {
  const missingVars = [];

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    missingVars.push('NEXT_PUBLIC_GOOGLE_CLIENT_ID');
  }
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    missingVars.push('GOOGLE_CLIENT_SECRET');
  }
  if (!process.env.NEXT_PUBLIC_REDIRECT_URI) {
    missingVars.push('NEXT_PUBLIC_REDIRECT_URI');
  }

  return NextResponse.json({
    status: missingVars.length === 0 ? 'OK' : 'MISSING_ENV_VARS',
    missingVars,
    envVars: {
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? '✓' : '✗',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✓' : '✗',
      NEXT_PUBLIC_REDIRECT_URI: process.env.NEXT_PUBLIC_REDIRECT_URI ? '✓' : '✗',
    },
  });
}
