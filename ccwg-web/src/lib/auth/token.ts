//ccwg/ccwg-web/src/lib/auth/token.ts

import 'server-only';
import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SESSION_SECRET;
if (!AUTH_SECRET) {
  throw new Error('AUTH_SESSION_SECRET is not set');
}

export type TokenType = 'access' | 'refresh' | 'nonce' | 'csrf';

type TokenPayload<T> = {
  typ: TokenType;
  iat: number;
  exp: number;
  jti?: string;
  data: T;
};

const toBase64Url = (input: Buffer | string): string => {
  return Buffer.from(input).toString('base64url');
};

const fromBase64Url = (input: string): string => {
  return Buffer.from(input, 'base64url').toString('utf8');
};

const sign = (payloadB64: string, secret: string = AUTH_SECRET!): string => {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadB64);
  return toBase64Url(hmac.digest());
};

const safeEqual = (a: string, b: string): boolean => {
  try {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
};

export const createToken = <T>(
  typ: TokenType,
  data: T,
  ttlSeconds: number,
  options: { jti?: string } = {}
): string => {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const payload: TokenPayload<T> = { typ, iat, exp, data, ...options };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
};

export const verifyToken = <T>(
  token: string,
  typ: TokenType,
  options: { gracePeriod?: number } = {}
): (T & { jti?: string }) | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, sig] = parts;
    const expectedSig = sign(payloadB64);
    if (!safeEqual(sig, expectedSig)) return null;

    const payload = JSON.parse(fromBase64Url(payloadB64)) as TokenPayload<T>;
    if (payload.typ !== typ) return null;

    const now = Math.floor(Date.now() / 1000);
    const gracePeriod = options.gracePeriod ?? 0;
    if (payload.exp + gracePeriod < now) return null;

    return { ...payload.data, jti: payload.jti };
  } catch {
    return null;
  }
};

export const generateTokenId = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * ✅ FIX:
 * Nonce must fit within Starknet felt range.
 * 32 random bytes can exceed the field prime and break typed-data hashing.
 * 31 bytes (248 bits) is always safe.
 */
export const generateNonce = (): string => {
  return `0x${crypto.randomBytes(31).toString('hex')}`;
};

export const generateCSRFToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const hashFingerprint = (components: string[]): string => {
  const data = components.join('|');
  return crypto.createHash('sha256').update(data).digest('hex');
};
