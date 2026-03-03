'use client';

import { useEffect, useState, useCallback } from 'react';
import { LoadingSplash } from './LoadingSplash';

const BOOT_SEEN_KEY = 'ccwg:boot_seen_v2';

/**
 * GameBootGate — shows the cinematic loading splash on first session visit,
 * then gates on player status. Subsequent same-session navigations skip the splash.
 */
export function GameBootGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<'splash' | 'ready'>('splash');
  const [dataReady, setDataReady] = useState(false);

  // Check if already booted this session
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = sessionStorage.getItem(BOOT_SEEN_KEY);
    if (seen === '1') {
      setPhase('ready');
      return;
    }
    // Kick off any data pre-fetch alongside the splash
    prefetchPlayerStatus();
  }, []);

  const prefetchPlayerStatus = async () => {
    try {
      // Pre-warm player status (non-blocking)
      await fetch('/api/player/status', { cache: 'no-store' });
    } catch {
      // ignore — the game can load without this pre-fetch
    } finally {
      setDataReady(true);
    }
  };

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem(BOOT_SEEN_KEY, '1');
    setPhase('ready');
  }, []);

  if (phase === 'ready') {
    return <>{children}</>;
  }

  return (
    <>
      <LoadingSplash
        onComplete={handleSplashComplete}
        dataReady={dataReady}
        minDuration={3200}
      />
      {/* Render children behind the splash so they start loading immediately */}
      <div className="invisible fixed inset-0 pointer-events-none" aria-hidden>
        {children}
      </div>
    </>
  );
}
