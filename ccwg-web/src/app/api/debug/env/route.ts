// ccwg-web/src/app/api/debug/nonce/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { NonceStore } from '@/src/lib/auth/session-store';

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  // This is a hack to inspect the nonce cache
  // In production, you'd want better debugging tools
  return NextResponse.json({
    message: 'Check server console for nonce cache state',
    address,
    note: 'Nonces are logged on the server side',
  });
}