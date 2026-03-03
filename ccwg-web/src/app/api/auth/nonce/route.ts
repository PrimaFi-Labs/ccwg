// ccwg-web/src/app/api/auth/nonce/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { addressSchema } from '@/src/lib/validation/schemas';
import {
  NONCE_COOKIE,
  NONCE_TTL_SECONDS,
  createNoncePayload,
} from '@/src/lib/auth/session';
import { RateLimiter } from '@/src/lib/auth/session-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet_address = searchParams.get('wallet_address');

    if (!wallet_address) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    const parsed = addressSchema.safeParse(wallet_address);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Rate limit: 10 nonce requests per minute per wallet
    if (!RateLimiter.check(wallet_address, 10, 60000)) {
      return NextResponse.json(
        { error: 'Too many nonce requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { token, typedData, issuedAt } = createNoncePayload(
      wallet_address,
      request
    );

    const response = NextResponse.json({
      typedData,
      issued_at: issuedAt,
    });

    // ✅ prevent any caching weirdness
    response.headers.set('Cache-Control', 'no-store');

    response.cookies.set(NONCE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: NONCE_TTL_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[Auth Nonce] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
