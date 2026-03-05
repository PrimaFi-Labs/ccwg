// ccwg-web/src/components/auth/ConnectWallet.tsx

'use client';

import { useEffect, useMemo, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core';
import { ControllerConnector } from '@cartridge/connector';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User, RefreshCw, AlertCircle } from 'lucide-react';

/** Cartridge controller "C" logomark — 20×20 inline SVG so no external asset is needed. */
function CartridgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5.1-3.6H13v2.5h2.9v2.2H13v2.5h2.9v1.2a.2.2 0 0 1-.2.2h-6a.2.2 0 0 1-.2-.2V7.2c0-.11.09-.2.2-.2h6c.11 0 .2.09.2.2v1.2Z"
        fill="currentColor"
      />
    </svg>
  );
}
import { useAuthSession } from '@/src/hooks/useAuthSession';

const LAST_CONNECTOR_KEY = 'ccwg:last_starknet_connector';

function isKeychainTimeout(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
  return (
    msg.includes('timeout waiting for keychain') ||
    msg.includes('keychain timeout') ||
    msg.includes('cartridge keychain timed out') ||
    msg === 'timeout'
  );
}

interface ConnectWalletProps {
  compact?: boolean;
}

export function ConnectWallet({ compact = false }: ConnectWalletProps) {
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected, isConnecting } = useAccount();

  const [username, setUsername] = useState<string | undefined>();
  const [showMenu, setShowMenu] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const { sessionReady, isAuthenticating, signingMessage, error: authError, reAuthenticate } = useAuthSession();

  const mountedRef = useRef(false);
  const lastProfileUpdateRef = useRef<{ wallet?: string; username?: string }>({});
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!showMenu) return;

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current && !menuRef.current.contains(target)) setShowMenu(false);
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showMenu]);

  const controller = useMemo(() => {
    const ctrl = connectors.find((c): c is ControllerConnector => c instanceof ControllerConnector);
    if (ctrl) {
      console.log('[ConnectWallet] Controller connector found');
    } else {
      console.warn('[ConnectWallet] Controller connector NOT found in connectors:', connectors);
    }
    return ctrl;
  }, [connectors]);

  // ── Cartridge iframe readiness ───────────────────────────────────────────
  // The controller spawns a cross-origin iframe at x.cartridge.gg on mount.
  // It only becomes usable once that iframe posts its ready handshake back (the
  // internal `this.keychain` property gets set). Calling connect() before that
  // point throws "Not ready to connect". We poll controller.isReady() every
  // 150 ms and track the result so we can gate the button and auto-fire any
  // click that arrived before the iframe was up.
  const [iframeReady, setIframeReady] = useState(false);
  // true when the user clicked Connect before the iframe was ready
  const [pendingConnect, setPendingConnect] = useState(false);

  useEffect(() => {
    if (!controller) { setIframeReady(false); return; }
    // If already ready on first render (e.g. hot reload), skip polling
    if (controller.isReady()) { setIframeReady(true); return; }

    const tid = setInterval(() => {
      if (controller.isReady()) {
        setIframeReady(true);
        clearInterval(tid);
      }
    }, 150);
    return () => clearInterval(tid);
  }, [controller]);

  // Fetch username when connected
  useEffect(() => {
    if (!address || !controller) return;

    let isActive = true;

    const fetchUsername = async () => {
      try {
        const name = await controller.username?.();
        if (isActive && name) {
          console.log('[ConnectWallet] Username fetched:', name);
          setUsername(name);
        }
      } catch (error) {
        console.error('[ConnectWallet] Failed to fetch username:', error);
        if (isActive) setUsername(undefined);
      }
    };

    fetchUsername();

    return () => {
      isActive = false;
    };
  }, [address, controller]);

  // Sync username to server profile once session is ready
  useEffect(() => {
    if (!sessionReady || !address || !username) return;

    const wallet = address.toLowerCase();
    const last = lastProfileUpdateRef.current;
    if (last.wallet === wallet && last.username === username) return;

    lastProfileUpdateRef.current = { wallet, username };

    fetch('/api/player/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    }).catch((err) => {
      console.error('[ConnectWallet] Failed to sync username:', err);
    });
  }, [sessionReady, address, username]);

  const handleConnect = useCallback(async () => {
    if (!mountedRef.current) {
      console.log('[ConnectWallet] Component not mounted, aborting connect');
      return;
    }

    if (!controller) {
      console.error('[ConnectWallet] Controller connector not available');
      setConnectionError('Controller connector not available. Please refresh the page.');
      return;
    }

    // If the iframe hasn't loaded yet, queue the connect. The auto-fire
    // effect below will trigger it as soon as the channel is ready
    // (usually within 1-3 s of page load).
    if (!iframeReady) {
      console.log('[ConnectWallet] Controller iframe not ready yet, queuing connect');
      setPendingConnect(true);
      return;
    }
    setPendingConnect(false);

    if (isConnecting) {
      console.log('[ConnectWallet] Already connecting, aborting');
      return;
    }

    setConnectionError(null);
    console.log('[ConnectWallet] Initiating connection...');

    try {
      await connect({ connector: controller });
      localStorage.setItem(LAST_CONNECTOR_KEY, 'cartridge_controller');
      console.log('[ConnectWallet] Connection successful');
    } catch (error) {
      console.error('[ConnectWallet] Connection error:', error);

      // Keychain timeout fallback
      if (isKeychainTimeout(error)) {
        console.log('[ConnectWallet] Keychain timeout detected, trying fallback...');
        try {
          const open = (controller as any)?.controller?.open;
          if (typeof open === 'function') {
            console.log('[ConnectWallet] Opening keychain in first-party context');
            open({ redirectUrl: window.location.href });
            return;
          }
        } catch (e) {
          console.error('[ConnectWallet] Keychain open() fallback failed:', e);
          setConnectionError('Failed to open keychain. Please try again or refresh the page.');
        }
      }

      setConnectionError(
        error instanceof Error ? error.message : 'Connection failed. Please try again.'
      );
    }
  }, [controller, iframeReady, isConnecting, connect]);

  // Auto-fire a connect that was queued before the iframe was ready
  useEffect(() => {
    if (iframeReady && pendingConnect && !isConnected && !isConnecting) {
      console.log('[ConnectWallet] iframe now ready — firing queued connect');
      handleConnect();
    }
  }, [iframeReady, pendingConnect, isConnected, isConnecting, handleConnect]);

  const handleDisconnect = useCallback(async () => {
    console.log('[ConnectWallet] Disconnecting...');
    await fetch('/api/auth/session', { method: 'DELETE' }).catch((err) => {
      console.error('[ConnectWallet] Session deletion error:', err);
    });
    disconnect();
    localStorage.removeItem(LAST_CONNECTOR_KEY);
    setShowMenu(false);
    setUsername(undefined);
    setConnectionError(null);
    console.log('[ConnectWallet] Disconnected');
  }, [disconnect]);

  const handleReAuth = useCallback(async () => {
    console.log('[ConnectWallet] Re-authenticating...');
    await reAuthenticate();
    setShowMenu(false);
  }, [reAuthenticate]);

  const handleRetryConnect = useCallback(() => {
    setConnectionError(null);
    handleConnect();
  }, [handleConnect]);
  // Loading states
  if (isConnecting || isAuthenticating) {
    // Derive a descriptive label for what phase we're in
    const loadingLabel = isConnecting
      ? 'Connecting…'
      : signingMessage
        ? 'Check Cartridge popup…'
        : 'Authenticating…';

    if (compact) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <CartridgeIcon className="w-3 h-3 animate-spin" />
          {loadingLabel}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-end gap-2">
        <motion.button
          disabled
          animate={{ boxShadow: ['0 0 12px var(--accent-primary-glow)', '0 0 28px var(--accent-primary-glow)', '0 0 12px var(--accent-primary-glow)'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="px-6 py-3 rounded-xl flex items-center gap-2 font-medium text-sm"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--accent-primary)' }}
        >
          <CartridgeIcon className="w-4 h-4 animate-spin" />
          {loadingLabel}
        </motion.button>
        {signingMessage && (
          <p className="text-xs max-w-xs text-center" style={{ color: 'var(--accent-orange, #f59e0b)' }}>
            A Cartridge sign popup should appear. If nothing opened, check for a blocked popup or refresh the page.
          </p>
        )}
      </div>
    );
  }

  // Connected state
  if (isConnected && address) {
    // Compact mode: just a disconnect button for use inside dropdowns
    if (compact) {
      return (
        <button
          onClick={handleDisconnect}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors"
          style={{ color: 'var(--accent-red, #f87171)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Disconnect Wallet
        </button>
      );
    }

    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="px-6 py-3 rounded-xl flex items-center gap-2 transition-all font-medium text-sm"
          style={{
            background: sessionReady
              ? 'var(--accent-primary)'
              : 'var(--accent-orange, #f59e0b)',
            color: '#fff',
            boxShadow: sessionReady ? '0 0 20px var(--accent-primary-glow)' : 'none',
          }}
        >
          <User className="w-4 h-4" />
          <span>
            {username ?? `${address.slice(0, 6)}â€¦${address.slice(-4)}`}
          </span>
          {!sessionReady && <span className="text-xs opacity-80">(Pending)</span>}
        </button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl overflow-hidden z-50"
              style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-accent)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              <div className="p-4" style={{ borderBottom: '1px solid var(--border-base)' }}>
                <p className="text-sm font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                  {address.slice(0, 10)}â€¦{address.slice(-8)}
                </p>
                {sessionReady && (
                  <p className="text-xs mt-1.5 text-emerald-400">âœ“ Session Active</p>
                )}
                {authError && (
                  <p className="text-xs mt-1.5 text-red-400">âš  {authError}</p>
                )}
              </div>

              {!sessionReady && (
                <button
                  onClick={handleReAuth}
                  className="w-full px-4 py-3 flex items-center gap-2 text-sm transition-colors"
                  style={{ color: 'var(--accent-orange, #f59e0b)', borderBottom: '1px solid var(--border-base)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Re-authenticate
                </button>
              )}

              <button
                onClick={handleDisconnect}
                className="w-full px-4 py-3 flex items-center gap-2 text-sm transition-colors"
                style={{ color: 'var(--accent-red, #f87171)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Disconnected state
  // pending = user clicked before iframe was ready; we show a spinner and
  // auto-fire connect once the channel opens (see auto-fire effect above).
  const isWarmingUp = !!controller && !iframeReady;
  const showError = connectionError && !isConnecting && !pendingConnect;

  // Compact mode
  if (compact) {
    if (pendingConnect || isWarmingUp) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          {pendingConnect ? 'Connecting soon…' : 'Loading Cartridge…'}
        </div>
      );
    }
    return (
      <button
        onClick={handleConnect}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors"
        style={{ color: 'var(--accent-primary)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <CartridgeIcon className="w-4 h-4 shrink-0" />
        Connect Wallet
      </button>
    );
  }

  // Full-size disconnected button
  // While pending, the button becomes a subtle spinner so the player knows
  // their click was registered and the connect will fire automatically.
  const btnLabel = pendingConnect
    ? 'Connecting soon…'
    : isWarmingUp
      ? 'Loading Cartridge…'
      : 'Connect Wallet';
  const btnActive = !pendingConnect; // disable further clicks once queued

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        onClick={handleConnect}
        disabled={!btnActive}
        whileHover={btnActive ? { scale: 1.03 } : {}}
        whileTap={btnActive ? { scale: 0.97 } : {}}
        className="group relative px-8 py-3.5 rounded-xl flex items-center gap-2.5 font-semibold text-sm tracking-wide transition-all overflow-hidden disabled:cursor-wait"
        style={{
          background: 'var(--accent-primary)',
          color: '#fff',
          border: '1px solid var(--accent-primary)',
          boxShadow: '0 0 24px var(--accent-primary-glow)',
          opacity: pendingConnect || isWarmingUp ? 0.75 : 1,
        }}
      >
        {/* shimmer sweep — only when truly interactive */}
        {btnActive && !isWarmingUp && (
          <span
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s infinite linear',
            }}
          />
        )}
        {(pendingConnect || isWarmingUp) ? (
          <CartridgeIcon className="w-4 h-4 animate-spin relative z-10" />
        ) : (
          <CartridgeIcon className="w-5 h-5 relative z-10" />
        )}
        <span className="relative z-10">{btnLabel}</span>
      </motion.button>

      {showError && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-3 max-w-xs"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)' }}
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-300">{connectionError}</p>
              <button
                onClick={handleRetryConnect}
                className="text-xs text-red-300 hover:text-red-100 underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {!controller && (
        <p className="text-xs" style={{ color: 'var(--accent-orange, #f59e0b)' }}>Controller initializing…</p>
      )}
    </div>
  );
}