// ccwg-web/src/lib/auth/session-store.ts

import 'server-only';
import { LRUCache } from 'lru-cache';

export type SessionData = {
  wallet: string;
  username?: string;
  issuedAt: number;
  lastActivity: number;
  fingerprint: string;
  refreshTokenId: string;
};

export type NonceData = {
  address: string;
  nonce: string;
  issuedAt: number;
  fingerprint: string;
};

type RateLimitData = {
  count: number;
  resetAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __ccwg_auth_caches__:
    | {
        sessionCache: LRUCache<string, SessionData>;
        nonceCache: LRUCache<string, NonceData>;
        refreshTokenAllowlist: LRUCache<string, boolean>;
        rateLimitStore: LRUCache<string, RateLimitData>;
      }
    | undefined;
}

const getCaches = () => {
  if (!globalThis.__ccwg_auth_caches__) {
    globalThis.__ccwg_auth_caches__ = {
      sessionCache: new LRUCache<string, SessionData>({
        max: 10000,
        ttl: 1000 * 60 * 60 * 24 * 30,
        updateAgeOnGet: true,
        updateAgeOnHas: true,
      }),

      nonceCache: new LRUCache<string, NonceData>({
        max: 5000,
        ttl: 1000 * 60 * 15,
        updateAgeOnGet: true,
        updateAgeOnHas: true,
      }),

      refreshTokenAllowlist: new LRUCache<string, boolean>({
        max: 50000,
        ttl: 1000 * 60 * 60 * 24 * 30,
      }),

      rateLimitStore: new LRUCache<string, RateLimitData>({
        max: 100000,
        ttl: 1000 * 60 * 15,
      }),
    };
  }

  return globalThis.__ccwg_auth_caches__;
};

const { sessionCache, nonceCache, refreshTokenAllowlist, rateLimitStore } = getCaches();

export const SessionStore = {
  get(wallet: string): SessionData | null {
    const data = sessionCache.get(wallet.toLowerCase());
    return data ?? null;
  },

  set(wallet: string, data: SessionData): void {
    sessionCache.set(wallet.toLowerCase(), data);
  },

  delete(wallet: string): void {
    sessionCache.delete(wallet.toLowerCase());
  },

  updateActivity(wallet: string): void {
    const session = this.get(wallet);
    if (session) {
      session.lastActivity = Math.floor(Date.now() / 1000);
      this.set(wallet, session);
    }
  },

  clear(): void {
    sessionCache.clear();
  },
};

export const NonceStore = {
  get(key: string): NonceData | null {
    return nonceCache.get(key) ?? null;
  },

  set(key: string, data: NonceData, ttl: number): void {
    nonceCache.set(key, data, { ttl: ttl * 1000 });
  },

  delete(key: string): void {
    nonceCache.delete(key);
  },

  clear(): void {
    nonceCache.clear();
  },
};

export const RefreshTokenStore = {
  isAllowed(tokenId: string): boolean {
    return refreshTokenAllowlist.has(tokenId);
  },

  allow(tokenId: string, ttl: number): void {
    refreshTokenAllowlist.set(tokenId, true, { ttl: ttl * 1000 });
  },

  revoke(tokenId: string): void {
    refreshTokenAllowlist.delete(tokenId);
  },

  revokeAll(wallet: string): void {
    SessionStore.delete(wallet);
  },

  clear(): void {
    refreshTokenAllowlist.clear();
  },
};

export const RateLimiter = {
  check(wallet: string, maxRequests: number = 60, windowMs: number = 60000): boolean {
    const key = wallet.toLowerCase();
    const now = Date.now();
    const limit = rateLimitStore.get(key);

    if (!limit || limit.resetAt < now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (limit.count >= maxRequests) return false;

    limit.count++;
    rateLimitStore.set(key, limit);
    return true;
  },

  reset(wallet: string): void {
    rateLimitStore.delete(wallet.toLowerCase());
  },
};

type PendingRequest<T> = Promise<T>;
const pendingRequests = new Map<string, PendingRequest<any>>();

export const RequestDeduplicator = {
  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = pendingRequests.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fn().finally(() => {
      pendingRequests.delete(key);
    });

    pendingRequests.set(key, promise);
    return promise;
  },
};