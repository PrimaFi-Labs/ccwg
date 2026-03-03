// ccwg-web/src/hooks/useAuthSession.ts
// Auth flow (Twitter-style persistence):
//   1. Page opens → starknet-react autoConnect re-attaches wallet silently
//   2. useAuthSession fires:
//      a. Check existing session  (GET /api/auth/session)  — access cookie still valid
//      b. Silent refresh           (PUT /api/auth/session)  — 30-day refresh cookie, no popup
//      c. Full sign-in             (sign once)              — only on first login or after 30 days
//   Returning players never see a sign popup unless 30+ days have passed.

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAccount } from '@starknet-react/core';

type AuthSessionState = {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  sessionReady: boolean;
  signingMessage: boolean; // true while waiting for the Cartridge keychain popup
  error: string | null;
};

// How often to silently refresh the 1-hour access token (fires 5 min before expiry)
const REFRESH_INTERVAL_MS = 55 * 60 * 1000;
// Per-tab cache key — avoids redundant API calls during page navigation
const SESSION_STORAGE_KEY = 'ccwg:auth_state';
// Max sign-in attempts before giving up with an error message
const MAX_SIGN_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Keychain timeout helpers
// The Cartridge keychain runs in a cross-origin iframe. On first load (or
// after a browser eviction) the iframe hasn't hydrated yet and any postMessage
// roundtrip times out. Retrying after a short back-off gives the iframe time
// to become ready without surfacing a confusing error to the player.
// ---------------------------------------------------------------------------
const SIGN_MAX_RETRIES = 3; // total attempts before giving up
const SIGN_RETRY_BASE_MS = 1500; // delay grows by this amount per retry

function isKeychainTimeoutError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
  return (
    msg.includes('timeout waiting for keychain') ||
    msg.includes('keychain timeout') ||
    msg.includes('cartridge keychain timed out') ||
    msg === 'timeout'
  );
}

async function signMessageWithRetry(account: any, typedData: any): Promise<any> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SIGN_MAX_RETRIES; attempt++) {
    try {
      return await account.signMessage(typedData);
    } catch (err) {
      lastError = err;
      if (isKeychainTimeoutError(err) && attempt < SIGN_MAX_RETRIES) {
        const delay = attempt * SIGN_RETRY_BASE_MS;
        console.warn(
          `[useAuthSession] Keychain timeout attempt ${attempt}/${SIGN_MAX_RETRIES}. ` +
          `Retrying in ${delay}ms…`
        );
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function safeJson(obj: any) {
  return JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? `0x${v.toString(16)}` : v));
}


export const useAuthSession = () => {
  const { address, isConnected, account } = useAccount();

  const [state, setState] = useState<AuthSessionState>({
    isAuthenticated: false,
    isAuthenticating: false,
    sessionReady: false,
    signingMessage: false,
    error: null,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const authInFlightRef = useRef(false);
  const signAttemptsRef = useRef(0);

  // ── Per-tab sessionStorage cache ──────────────────────────────────────
  // Optimistic restore within the same browser tab — avoids a flash of
  // "not connected" on page navigation. We still verify with the server
  // immediately via the refresh interval.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.address === address && parsed.sessionReady) {
          setState((prev) => ({ ...prev, sessionReady: true, isAuthenticated: true }));
        }
      }
    } catch { /* ignore */ }
  }, [address]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (state.sessionReady && address) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ address, sessionReady: true }));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [state.sessionReady, address]);

  // ── Step 1: check active access-token cookie ─────────────────────────
  const checkSession = useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      if (data?.wallet_address?.toLowerCase() === address.toLowerCase()) {
        console.log('[useAuthSession] ✓ Active session confirmed');
        return true;
      }
      return false;
    } catch { return false; }
  }, [address]);

  // ── Step 2: silent refresh using the 30-day refresh cookie ───────────
  // No user interaction — server issues a new access token if the refresh
  // cookie is valid. This is what makes returning players "stay logged in".
  const trySilentRefresh = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[useAuthSession] Attempting silent refresh…');
      const res = await fetch('/api/auth/session', { method: 'PUT' });
      if (res.ok) {
        console.log('[useAuthSession] ✓ Silent refresh succeeded');
        return true;
      }
      return false;
    } catch { return false; }
  }, []);

  // ── Full sign-in flow (step 3 — only when steps 1 and 2 fail) ────────
  const createSession = useCallback(
    async (forceNew = false) => {
      if (!address || !account) return;
      if (authInFlightRef.current) { console.log('[useAuthSession] in-flight, skipping'); return; }
      authInFlightRef.current = true;

      try {
        setState((prev) => ({ ...prev, isAuthenticating: true, error: null }));

        // Step 1 — active access token?
        if (!forceNew) {
          if (await checkSession()) {
            signAttemptsRef.current = 0;
            setState((prev) => ({ ...prev, sessionReady: true, isAuthenticated: true, isAuthenticating: false }));
            return;
          }
          // Step 2 — silent refresh with 30-day cookie?
          if (await trySilentRefresh()) {
            signAttemptsRef.current = 0;
            setState((prev) => ({ ...prev, sessionReady: true, isAuthenticated: true, isAuthenticating: false }));
            return;
          }
        }

        // Step 3 — full sign-in (requires wallet popup)
        signAttemptsRef.current += 1;
        if (signAttemptsRef.current > MAX_SIGN_ATTEMPTS) {
          setState((prev) => ({
            ...prev,
            isAuthenticating: false,
            signingMessage: false,
            error: 'Authentication failed after multiple attempts. Please refresh the page.',
          }));
          return;
        }

        console.log('[useAuthSession] Starting sign-in, attempt', signAttemptsRef.current);

        const nonceRes = await fetch(`/api/auth/nonce?wallet_address=${address}`, { cache: 'no-store' });
        if (!nonceRes.ok) {
          const d = await nonceRes.json().catch(() => ({}));
          throw new Error((d as any).error || 'Failed to get nonce');
        }
        const { typedData } = await nonceRes.json();
        if (!typedData || typeof (account as any).signMessage !== 'function') {
          throw new Error('Invalid nonce data or account not ready');
        }

        let signature: any;
        try {
          setState((prev) => ({ ...prev, signingMessage: true }));
          signature = await signMessageWithRetry(account, typedData);
          console.log('[useAuthSession] ✓ Signature obtained, len:', Array.isArray(signature) ? signature.length : '?');
        } catch (signErr) {
          throw new Error(
            isKeychainTimeoutError(signErr)
              ? 'Cartridge keychain timed out. Check for a blocked popup, then retry.'
              : 'User rejected the sign request'
          );
        } finally {
          setState((prev) => ({ ...prev, signingMessage: false }));
        }

        const sessionRes = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: safeJson({ wallet_address: address, signature }),
        });
        if (!sessionRes.ok) {
          const d = await sessionRes.json().catch(() => ({}));
          throw new Error((d as any).error || 'Session creation failed');
        }

        console.log('[useAuthSession] ✓ Session created');
        signAttemptsRef.current = 0;
        setState((prev) => ({ ...prev, sessionReady: true, isAuthenticated: true, isAuthenticating: false, error: null }));
      } catch (err) {
        console.error('[useAuthSession] Error:', err);
        setState((prev) => ({
          ...prev,
          isAuthenticating: false,
          signingMessage: false,
          error: err instanceof Error ? err.message : 'Authentication failed',
        }));
      } finally {
        authInFlightRef.current = false;
      }
    },
    [address, account, checkSession, trySilentRefresh]
  );

  // ── Trigger auth when wallet connects ────────────────────────────────
  useEffect(() => {
    if (isConnected && address && account && !state.sessionReady && !state.isAuthenticating) {
      // Small delay so the Cartridge iframe has started warming up before we
      // might need signMessage in step 3. Steps 1 & 2 don't need the iframe.
      const tid = setTimeout(() => createSession(), 200);
      return () => clearTimeout(tid);
    }
    if (!isConnected || !address) {
      signAttemptsRef.current = 0;
      setState({ isAuthenticated: false, isAuthenticating: false, sessionReady: false, signingMessage: false, error: null });
    }
  }, [isConnected, address, account, state.sessionReady, state.isAuthenticating, createSession]);

  // ── Periodic silent refresh (55 min interval, keeps access token alive) ─
  useEffect(() => {
    if (!state.sessionReady) {
      if (refreshTimerRef.current) { clearInterval(refreshTimerRef.current); refreshTimerRef.current = undefined; }
      return;
    }

    const silentCheck = async () => {
      const ok = await trySilentRefresh();
      if (!ok) {
        // Both tokens gone — clear and let the effect above trigger re-auth
        console.warn('[useAuthSession] Periodic refresh failed — clearing session');
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        signAttemptsRef.current = 0;
        setState({ isAuthenticated: false, isAuthenticating: false, sessionReady: false, signingMessage: false, error: null });
      }
    };
    // Fire once immediately to confirm/repair on mount, then on interval
    silentCheck();
    refreshTimerRef.current = setInterval(silentCheck, REFRESH_INTERVAL_MS);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [state.sessionReady, trySilentRefresh]);

  // ── Public API ─────────────────────────────────────────────────────────
  const refresh = useCallback(async () => trySilentRefresh(), [trySilentRefresh]);

  const reAuthenticate = useCallback(async () => {
    signAttemptsRef.current = 0;
    setState((prev) => ({ ...prev, error: null, signingMessage: false }));
    await createSession(true);
  }, [createSession]);

  return { ...state, refresh, reAuthenticate };
};