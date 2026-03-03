'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAccount } from '@starknet-react/core';

const HEARTBEAT_MS = 45_000;

export function PresenceBeacon() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();

  useEffect(() => {
    if (!isConnected || !address) return;

    let cancelled = false;

    const heartbeat = async () => {
      try {
        await fetch('/api/social/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_page: pathname }),
          cache: 'no-store',
        });
      } catch {
        // Presence is best-effort only.
      }
    };

    void heartbeat();
    const intervalId = window.setInterval(() => {
      if (!cancelled) {
        void heartbeat();
      }
    }, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [address, isConnected, pathname]);

  return null;
}
