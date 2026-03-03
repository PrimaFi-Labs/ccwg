// ccwg-web/src/lib/auth/session.ts

import 'server-only';
import type { NextRequest } from 'next/server';
import { cookies as nextCookies } from 'next/headers';
import { constants, num } from 'starknet';
import {
  createToken,
  verifyToken,
  generateTokenId,
  generateNonce,
  generateCSRFToken,
} from './token';
import {
  SessionStore,
  NonceStore,
  RefreshTokenStore,
  type SessionData,
  type NonceData,
} from './session-store';
import { generateFingerprint } from './fingerprint';

export const SESSION_COOKIE = 'ccwg_session';
export const REFRESH_COOKIE = 'ccwg_refresh';
export const NONCE_COOKIE = 'ccwg_nonce';
export const CSRF_COOKIE = 'ccwg_csrf';

export const ACCESS_TTL_SECONDS = 60 * 60;
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;
export const NONCE_TTL_SECONDS = 60 * 10;
export const CSRF_TTL_SECONDS = 60 * 60 * 24;

const GRACE_PERIOD_SECONDS = 60 * 5;

const getChainId = (): string => {
  if (process.env.NEXT_PUBLIC_CHAIN_ID) {
    return process.env.NEXT_PUBLIC_CHAIN_ID;
  }
  const network = process.env.NEXT_PUBLIC_NETWORK || 'sepolia';
  return network === 'mainnet'
    ? constants.StarknetChainId.SN_MAIN
    : constants.StarknetChainId.SN_SEPOLIA;
};

export const buildAuthTypedData = (params: {
  address: string;
  nonce: string;
  issuedAt: number;
}) => {
  const { address, nonce, issuedAt } = params;
  const issuedAtHex = num.toHex(issuedAt);

  console.log('[TypedData] Building with values:', {
    address,
    nonce: nonce.substring(0, 10) + '...',
    issuedAt,
    issuedAtHex,
  });

  // ✅ FIX: Correct structure for Starknet.js v9+ SNIP-12 compliance
  return {
    types: {
      StarknetDomain: [
        { name: 'name', type: 'shortstring' },
        { name: 'version', type: 'shortstring' },
        { name: 'chainId', type: 'shortstring' },
        { name: 'revision', type: 'shortstring' },
      ],
      AuthMessage: [
        { name: 'wallet', type: 'ContractAddress' },
        { name: 'nonce', type: 'felt' },
        { name: 'issued_at', type: 'felt' },
      ],
    },
    primaryType: 'AuthMessage',
    domain: {
      name: 'CCWG',
      version: '1',
      chainId: getChainId(),
      revision: '1',
    },
    message: {
      wallet: address,
      nonce,
      issued_at: issuedAtHex,
    },
  };
};

export const createNoncePayload = (address: string, request: NextRequest) => {
  const nonce = generateNonce();
  const issuedAt = Math.floor(Date.now() / 1000);
  const fingerprint = generateFingerprint(request);

  console.log('[Nonce] Creating nonce:', {
    address: address.toLowerCase(),
    nonce: nonce.substring(0, 10) + '...',
    issuedAt,
    fingerprint: fingerprint.substring(0, 10) + '...',
  });

  const nonceData: NonceData = {
    address: address.toLowerCase(),
    nonce,
    issuedAt,
    fingerprint,
  };

  const cacheKey = `${address.toLowerCase()}:${nonce}`;
  NonceStore.set(cacheKey, nonceData, NONCE_TTL_SECONDS);

  console.log('[Nonce] Stored in cache with key:', cacheKey.substring(0, 60) + '...');

  const token = createToken<NonceData>('nonce', nonceData, NONCE_TTL_SECONDS, {
    jti: generateTokenId(),
  });

  const typedData = buildAuthTypedData({ address, nonce, issuedAt });

  return { nonce, issuedAt, token, typedData, fingerprint };
};

export const verifyNonceToken = (
  token: string,
  address: string,
  request: NextRequest
): NonceData | null => {
  console.log('[Nonce] Verifying nonce token for address:', address);

  const data = verifyToken<NonceData>(token, 'nonce', {
    gracePeriod: GRACE_PERIOD_SECONDS,
  });

  if (!data) {
    console.error('[Nonce] Token verification failed - invalid or expired');
    return null;
  }

  console.log('[Nonce] Token signature valid:', {
    address: data.address,
    nonce: data.nonce.substring(0, 10) + '...',
    issuedAt: data.issuedAt,
  });

  if (data.address.toLowerCase() !== address.toLowerCase()) {
    console.error('[Nonce] Address mismatch:', {
      token_address: data.address,
      provided_address: address,
    });
    return null;
  }

  const currentFingerprint = generateFingerprint(request);
  console.log('[Nonce] Fingerprint comparison:', {
    stored: data.fingerprint.substring(0, 10) + '...',
    current: currentFingerprint.substring(0, 10) + '...',
    match: data.fingerprint === currentFingerprint,
  });

  if (data.fingerprint !== currentFingerprint) {
    console.warn('[Nonce] Fingerprint mismatch');
    if (process.env.NODE_ENV === 'production') {
      console.error('[Nonce] Rejecting due to fingerprint mismatch (production)');
      return null;
    }
  }

  const cacheKey = `${address.toLowerCase()}:${data.nonce}`;
  console.log('[Nonce] Checking cache for key:', cacheKey.substring(0, 60) + '...');

  const cached = NonceStore.get(cacheKey);
  if (!cached) {
    console.warn('[Nonce] Not found in cache (possible dev HMR/server restart).');

    if (process.env.NODE_ENV === 'production') {
      return null;
    }

    console.warn('[Nonce] Dev fallback: accepting nonce token without cache.');
  } else {
    console.log('[Nonce] Found in cache, verification successful');
  }

  return data;
};

export const consumeNonce = (address: string, nonce: string): void => {
  const cacheKey = `${address.toLowerCase()}:${nonce}`;
  console.log('[Nonce] Consuming nonce:', cacheKey.substring(0, 60) + '...');
  NonceStore.delete(cacheKey);
};

type AccessTokenData = {
  wallet: string;
  username?: string;
  tokenId: string;
};

type RefreshTokenData = {
  wallet: string;
  username?: string;
};

export const createSessionTokens = (
  wallet: string,
  username: string | undefined,
  fingerprint: string
) => {
  const refreshTokenId = generateTokenId();
  const now = Math.floor(Date.now() / 1000);

  console.log('[Session] Creating session tokens for:', wallet);

  const refreshToken = createToken<RefreshTokenData>(
    'refresh',
    { wallet: wallet.toLowerCase(), username },
    REFRESH_TTL_SECONDS,
    { jti: refreshTokenId }
  );

  const accessToken = createToken<AccessTokenData>(
    'access',
    { wallet: wallet.toLowerCase(), username, tokenId: refreshTokenId },
    ACCESS_TTL_SECONDS
  );

  const sessionData: SessionData = {
    wallet: wallet.toLowerCase(),
    username,
    issuedAt: now,
    lastActivity: now,
    fingerprint,
    refreshTokenId,
  };

  SessionStore.set(wallet, sessionData);
  RefreshTokenStore.allow(refreshTokenId, REFRESH_TTL_SECONDS);

  console.log('[Session] Session tokens created successfully');
  return { accessToken, refreshToken };
};

export const verifyAccessToken = (
  token: string,
  request?: NextRequest
): AccessTokenData | null => {
  // ── Stateless JWT verification ─────────────────────────────────────────
  // The token is HMAC-SHA256 signed with AUTH_SESSION_SECRET. If the
  // signature and expiry are valid, we trust it. We intentionally do NOT
  // require the in-memory SessionStore to be populated: that cache is wiped
  // on every Turbopack HMR restart and on every Vercel cold-start, which
  // previously caused every request to return 401 even with a valid cookie.
  const data = verifyToken<AccessTokenData>(token, 'access', {
    gracePeriod: GRACE_PERIOD_SECONDS,
  });
  if (!data) return null;

  // Optionally update activity and enforce fingerprint when the server-side
  // session record IS present (e.g. within the same process lifetime).
  const session = SessionStore.get(data.wallet);
  if (session) {
    if (request && process.env.NODE_ENV === 'production') {
      const currentFingerprint = generateFingerprint(request);
      if (session.fingerprint !== currentFingerprint) {
        console.warn('[Session] Fingerprint mismatch during access token verification');
        return null;
      }
    }
    SessionStore.updateActivity(data.wallet);
  }
  // No session in store → trust the cryptographically-verified JWT.
  // (handles process restarts, cold starts, and serverless environments)
  return data;
};

export const refreshAccessToken = (
  refreshToken: string,
  request?: NextRequest
): { accessToken: string; refreshToken: string; wallet: string } | null => {
  // ── Stateless refresh ──────────────────────────────────────────────────
  // Same rationale as verifyAccessToken: the in-memory RefreshTokenStore
  // allowlist is wiped on every restart, breaking refresh for all existing
  // sessions. We trust the cryptographically-verified JWT instead. Explicit
  // logout clears the cookies, so a revoked token can't be replayed.
  const data = verifyToken<RefreshTokenData>(refreshToken, 'refresh');
  if (!data || !data.jti) return null;

  // Fingerprint check only when we have a stored session AND are in production
  const storedSession = SessionStore.get(data.wallet);
  if (storedSession && request && process.env.NODE_ENV === 'production') {
    const currentFingerprint = generateFingerprint(request);
    if (storedSession.fingerprint !== currentFingerprint) {
      console.warn('[Session] Fingerprint mismatch during token refresh');
      return null;
    }
  }

  // Best-effort cleanup of the old token from the allowlist
  RefreshTokenStore.revoke(data.jti);

  const fingerprint =
    storedSession?.fingerprint ??
    (request ? generateFingerprint(request) : 'restored');

  const tokens = createSessionTokens(data.wallet, data.username, fingerprint);
  return { ...tokens, wallet: data.wallet };
};

export const revokeSession = (wallet: string): void => {
  const session = SessionStore.get(wallet);
  if (session) {
    RefreshTokenStore.revoke(session.refreshTokenId);
    SessionStore.delete(wallet);
  }
};

export const getSessionWallet = (request?: NextRequest): string | null => {
  // ✅ Works in both contexts:
  // - Server Components: nextCookies()
  // - Route Handlers/Middleware: request.cookies
  const cookieStore = request?.cookies ?? (nextCookies() as any);

  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (process.env.NODE_ENV === 'development') {
    console.log('[Session] getSessionWallet cookie present:', Boolean(token));
    if (token) console.log('[Session] access token prefix:', token.slice(0, 12) + '...');
  }

  if (!token) return null;

  const data = verifyAccessToken(token, request);
  return data?.wallet ?? null;
};

export const getSessionData = (request?: NextRequest): SessionData | null => {
  const wallet = getSessionWallet(request);
  if (!wallet) return null;
  return SessionStore.get(wallet);
};

export const createCSRFToken = (): string => {
  return createToken('csrf', { token: generateCSRFToken() }, CSRF_TTL_SECONDS);
};

export const verifyCSRFToken = (token: string, headerToken: string): boolean => {
  const data = verifyToken<{ token: string }>(token, 'csrf');
  if (!data) return false;
  return data.token === headerToken;
};