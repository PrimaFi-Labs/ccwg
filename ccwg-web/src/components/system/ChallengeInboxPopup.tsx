'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccount } from '@starknet-react/core';
import { motion } from 'framer-motion';
import { BellRing, CheckCircle2, Loader2, X, XCircle } from 'lucide-react';

type ChallengeItem = {
  challenge_id: number;
  direction: 'incoming' | 'outgoing';
  wallet_address: string;
  username: string | null;
  online: boolean;
  match_id: number;
  total_rounds: number;
  swap_rule: 'Fun' | 'Strict';
  status: 'Pending' | 'Accepted';
  expires_at: string;
  created_at: string;
};

type OverviewPayload = {
  challenges: ChallengeItem[];
};

const POLL_MS = 6000;
const shortWallet = (value: string) => `${value.slice(0, 8)}...${value.slice(-6)}`;

export function ChallengeInboxPopup() {
  const pathname = usePathname();
  const router = useRouter();
  const { isConnected, address } = useAccount();

  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const hiddenByRoute = pathname?.startsWith('/match/') ?? false;

  const loadOverview = useCallback(async () => {
    if (!isConnected || !address || hiddenByRoute) return;
    try {
      const res = await fetch('/api/social/overview', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) return;
      setOverview(data);
    } catch {
      // Popup is best-effort only.
    }
  }, [address, hiddenByRoute, isConnected]);

  useEffect(() => {
    if (!isConnected || !address || hiddenByRoute) return;
    void loadOverview();
    const pollId = window.setInterval(() => {
      void loadOverview();
    }, POLL_MS);
    const tickId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(pollId);
      window.clearInterval(tickId);
    };
  }, [address, hiddenByRoute, isConnected, loadOverview]);

  const incomingPending = useMemo(
    () =>
      (overview?.challenges || []).filter(
        (item) =>
          item.direction === 'incoming' &&
          item.status === 'Pending' &&
          new Date(item.expires_at).getTime() > Date.now()
      ),
    [overview?.challenges]
  );

  useEffect(() => {
    if (dismissedIds.length === 0) return;
    const liveIds = new Set(incomingPending.map((item) => item.challenge_id));
    setDismissedIds((prev) => prev.filter((id) => liveIds.has(id)));
  }, [dismissedIds.length, incomingPending]);

  const activeChallenge = incomingPending.find((item) => !dismissedIds.includes(item.challenge_id));

  const runAction = async (action: 'accept' | 'decline', challengeId: number) => {
    const key = `${action}-${challengeId}`;
    setBusyKey(key);
    try {
      const res = await fetch('/api/social/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, challenge_id: challengeId }),
      });
      const data = await res.json();
      if (!res.ok) return;
      if (action === 'accept' && data?.match_id) {
        router.push(`/match/${data.match_id}-${Date.now().toString(36)}`);
      } else {
        setDismissedIds((prev) => [...prev, challengeId]);
        await loadOverview();
      }
    } catch {
      // Ignore transient popup errors.
    } finally {
      setBusyKey(null);
    }
  };

  if (!isConnected || !address || hiddenByRoute || !activeChallenge) return null;

  const secondsLeft = Math.max(0, Math.ceil((new Date(activeChallenge.expires_at).getTime() - nowMs) / 1000));
  const opponentLabel = activeChallenge.username || shortWallet(activeChallenge.wallet_address);
  const hasMore = incomingPending.filter((item) => item.challenge_id !== activeChallenge.challenge_id).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="fixed right-4 bottom-20 md:bottom-6 z-[70] w-[min(92vw,360px)] rounded-xl border p-3 space-y-3"
      style={{
        background: 'rgba(11,18,32,0.95)',
        borderColor: 'rgba(96,165,250,0.4)',
        boxShadow: '0 18px 40px rgba(2,8,23,0.55)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-tactical uppercase tracking-widest text-sky-300 flex items-center gap-1.5">
            <BellRing className="w-3.5 h-3.5" />
            Challenge Incoming
          </p>
          <p className="text-sm text-[var(--text-primary)] mt-1">
            <span className="font-semibold">{opponentLabel}</span> invited you ({activeChallenge.total_rounds}R, {activeChallenge.swap_rule})
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">Expires in {secondsLeft}s</p>
          {hasMore ? (
            <p className="text-[10px] text-[var(--text-muted)] mt-1">More challenges waiting in your queue.</p>
          ) : null}
        </div>
        <button
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          onClick={() => setDismissedIds((prev) => [...prev, activeChallenge.challenge_id])}
          aria-label="Dismiss challenge popup"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg py-2 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5"
          style={{ background: 'rgba(16,185,129,0.16)' }}
          disabled={secondsLeft <= 0 || busyKey === `accept-${activeChallenge.challenge_id}`}
          onClick={() => void runAction('accept', activeChallenge.challenge_id)}
        >
          {busyKey === `accept-${activeChallenge.challenge_id}` ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          Accept
        </button>
        <button
          className="flex-1 rounded-lg py-2 text-xs font-semibold text-rose-300 flex items-center justify-center gap-1.5"
          style={{ background: 'rgba(244,63,94,0.16)' }}
          disabled={busyKey === `decline-${activeChallenge.challenge_id}`}
          onClick={() => void runAction('decline', activeChallenge.challenge_id)}
        >
          {busyKey === `decline-${activeChallenge.challenge_id}` ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          Decline
        </button>
      </div>
    </motion.div>
  );
}
