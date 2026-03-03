// ccwg-web/src/app/api/auth/session/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyMessageInStarknet, type Signature } from 'starknet';
import { addressSchema } from '@/src/lib/validation/schemas';
import { RateLimiter } from '@/src/lib/auth/session-store';
import {
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  NONCE_COOKIE,
  SESSION_COOKIE,
  REFRESH_COOKIE,
  buildAuthTypedData,
  verifyNonceToken,
  consumeNonce,
  createSessionTokens,
  refreshAccessToken,
  revokeSession,
  getSessionWallet,
} from '@/src/lib/auth/session';
import { getRPCProviderPool } from '@/src/lib/rpc/provider';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';

export const dynamic = 'force-dynamic';

function toHexString(v: any): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return `0x${v.toString(16)}`;
  if (typeof v === 'bigint') return `0x${v.toString(16)}`;
  return String(v);
}

function isHexFelt(x: any): x is string {
  return typeof x === 'string' && x.startsWith('0x');
}

/**
 * ✅ FIX:
 * Cartridge Controller can return a "session signature payload" (often 32 felts),
 * not a plain [r, s]. Your previous logic trimmed to the last two values and broke verification.
 *
 * This normalizes signatures to a felt array and preserves the full array.
 */
function normalizeSignature(input: any): string[] | null {
  if (input == null) {
    console.error('[Signature] Null or undefined signature received');
    return null;
  }

  // Handle stringified JSON
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return normalizeSignature(JSON.parse(trimmed));
      } catch (e) {
        console.error('[Signature] Failed to parse JSON string:', e);
        return null;
      }
    }
    return null;
  }

  // Handle object wrappers
  if (typeof input === 'object' && !Array.isArray(input)) {
    if ('signature' in input) {
      console.log('[Signature] Found signature wrapper, extracting array');
      return normalizeSignature((input as any).signature);
    }

    if ('sig' in input) {
      console.log('[Signature] Found sig wrapper, extracting');
      return normalizeSignature((input as any).sig);
    }

    // Handle { r, s } format
    if ('r' in input && 's' in input) {
      console.log('[Signature] Found r,s object format');
      const r = toHexString((input as any).r);
      const s = toHexString((input as any).s);
      if (isHexFelt(r) && isHexFelt(s)) return [r, s];
      console.error('[Signature] Invalid r,s values');
      return null;
    }

    // Handle numeric keys {0: "r", 1: "s"}
    if ('0' in input && '1' in input) {
      console.log('[Signature] Found numeric keys 0,1');
      const r = toHexString((input as any)[0]);
      const s = toHexString((input as any)[1]);
      if (isHexFelt(r) && isHexFelt(s)) return [r, s];
      console.error('[Signature] Invalid numeric-key values');
      return null;
    }

    console.error('[Signature] Unknown object format, keys:', Object.keys(input));
    return null;
  }

  // Handle array: [r, s] OR controller multi-felt signature (keep full array!)
  if (Array.isArray(input)) {
    const arr = input.map((v) => toHexString(v));

    if (!arr.every(isHexFelt)) {
      console.error('[Signature] Array contains non-hex elements');
      return null;
    }

    // ✅ DO NOT trim. Return full felt array.
    return arr;
  }

  console.error('[Signature] Unexpected signature type:', typeof input);
  return null;
}

export async function GET(request: NextRequest) {
  const wallet = getSessionWallet(request);
  if (wallet) {
    try {
      await ensurePlayerExists(wallet);
    } catch (error) {
      console.error('[Auth Session] GET player bootstrap failed:', error);
    }
  }
  return NextResponse.json({
    wallet_address: wallet ?? null,
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Auth Session] POST started');

    const body = await request.json().catch(() => ({}));
    const wallet_address = body?.wallet_address as string | undefined;
    const signature = body?.signature;
    const username = body?.username as string | undefined;

    console.log('[Auth Session] Request body:', {
      wallet_address,
      has_signature: !!signature,
      username,
    });

    if (!wallet_address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const parsed = addressSchema.safeParse(wallet_address);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    console.log('[Auth Session] Checking rate limit for:', wallet_address);
    if (!RateLimiter.check(wallet_address, 10, 60000)) {
      return NextResponse.json(
        { error: 'Too many auth attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const nonceToken = request.cookies.get(NONCE_COOKIE)?.value;
    console.log('[Auth Session] Nonce cookie present:', !!nonceToken);

    if (!nonceToken) {
      return NextResponse.json(
        { error: 'Nonce missing. Please refresh and try again.' },
        { status: 401 }
      );
    }

    const nonceData = verifyNonceToken(nonceToken, wallet_address, request);
    if (!nonceData) {
      console.log('[Auth Session] Nonce verification failed');
      return NextResponse.json(
        { error: 'Nonce invalid or expired. Please refresh and try again.' },
        { status: 401 }
      );
    }

    const typedData = buildAuthTypedData({
      address: wallet_address,
      nonce: nonceData.nonce,
      issuedAt: nonceData.issuedAt,
    });

    console.log('[Auth Session] Starting signature verification...');

    // ✅ FIX: keep full signature array (Controller may return 32 felts)
    const sig = normalizeSignature(signature);

    if (!sig) {
      console.error('[Auth Session] Failed to normalize signature');
      return NextResponse.json(
        { error: 'Invalid signature format received.' },
        { status: 400 }
      );
    }

    console.log('[Auth Session] Normalized signature:', {
      len: sig.length,
      head: sig.slice(0, 6),
      tail: sig.slice(-6),
    });

    // ✅ Create proper Signature type for verifyMessageInStarknet
    const starknetSignature: Signature = sig as any;

    const pool = getRPCProviderPool();

    let isValid = false;
    try {
      isValid = await pool.withRetry(async (provider) => {
        console.log('[Auth Session] Attempting verification with provider');

        return await verifyMessageInStarknet(
          provider,
          typedData as any,
          starknetSignature,
          wallet_address
        );
      });
    } catch (err: any) {
      console.error('[Auth Session] Signature verification error:', err);

      const errMsg = err?.message || String(err);
      if (errMsg.includes('message-hash-mismatch')) {
        return NextResponse.json(
          {
            error:
              'Signature verification failed: message hash mismatch. The signed message does not match expected format.',
          },
          { status: 401 }
        );
      }

      if (errMsg.includes('invalid-signature-format')) {
        return NextResponse.json(
          { error: 'Signature verification failed: invalid signature format.' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Signature verification failed. Please try again.' },
        { status: 401 }
      );
    }

    console.log('[Auth Session] Signature is valid:', isValid);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Signature verification failed. Please try again.' },
        { status: 401 }
      );
    }

    try {
      await ensurePlayerExists(wallet_address, { username });
    } catch (bootstrapError) {
      console.error('[Auth Session] Player bootstrap failed:', bootstrapError);
      return NextResponse.json(
        { error: 'Failed to initialize player profile. Please try again.' },
        { status: 500 }
      );
    }

    consumeNonce(wallet_address, nonceData.nonce);

    const { accessToken, refreshToken } = createSessionTokens(
      wallet_address,
      username,
      nonceData.fingerprint
    );

    const res = NextResponse.json({
      wallet_address: wallet_address.toLowerCase(),
      username: username ?? null,
    });

    res.headers.set('Cache-Control', 'no-store');

    res.cookies.set(SESSION_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ACCESS_TTL_SECONDS,
      path: '/',
    });

    res.cookies.set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFRESH_TTL_SECONDS,
      path: '/',
    });

    res.cookies.set(NONCE_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('[Auth Session] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
    if (!refresh) return NextResponse.json({ ok: false }, { status: 401 });

    const refreshed = refreshAccessToken(refresh, request);
    if (!refreshed) return NextResponse.json({ ok: false }, { status: 401 });

    try {
      await ensurePlayerExists(refreshed.wallet);
    } catch (error) {
      console.error('[Auth Session] PUT player bootstrap failed:', error);
    }

    const res = NextResponse.json({ ok: true });
    res.headers.set('Cache-Control', 'no-store');

    res.cookies.set(SESSION_COOKIE, refreshed.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ACCESS_TTL_SECONDS,
      path: '/',
    });

    res.cookies.set(REFRESH_COOKIE, refreshed.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFRESH_TTL_SECONDS,
      path: '/',
    });

    return res;
  } catch (err) {
    console.error('[Auth Session] PUT refresh error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const wallet = getSessionWallet(request);
  if (wallet) revokeSession(wallet);

  const res = NextResponse.json({ ok: true });
  res.headers.set('Cache-Control', 'no-store');

  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });

  res.cookies.set(REFRESH_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });

  return res;
}
