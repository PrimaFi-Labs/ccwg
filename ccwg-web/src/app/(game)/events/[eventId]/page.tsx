'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from '@starknet-react/core';
import { CallData, cairo } from 'starknet';
import { CardSelector } from '@/src/components/cards/CardSelector';
import type { GameEvent, PlayerCard } from '@/src/types/database';
import { formatStrk } from '@/src/lib/cartridge/utils';
import { EVENT_SYSTEM_ADDRESS, ESCROW_SYSTEM_ADDRESS, STRK_TOKEN_ADDRESS } from '@/src/types/contracts';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  Swords, Trophy, Clock, Users, Zap, ChevronLeft, RefreshCw,
  Crown, Medal, Shield, Target, TrendingUp, Star,
  CheckCircle2, XCircle, X, AlertTriangle,
} from 'lucide-react';

/* ─── Inline toast system ─────────────────────────────────────────────── */
type ToastKind = 'success' | 'error' | 'warning' | 'info';
type ToastItem = { id: number; kind: ToastKind; message: string };

const TOAST_ICON: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />,
  error: <XCircle className="w-4 h-4 shrink-0 text-red-400" />,
  warning: <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />,
  info: <Swords className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />,
};

const TOAST_BORDER: Record<ToastKind, string> = {
  success: 'rgba(52,211,153,0.4)',
  error: 'rgba(248,113,113,0.4)',
  warning: 'rgba(251,191,36,0.4)',
  info: 'var(--border-accent)',
};

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm backdrop-blur-md"
            style={{
              background: 'var(--bg-panel)',
              border: `1px solid ${TOAST_BORDER[t.kind]}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              color: 'var(--text-primary)',
            }}
          >
            {TOAST_ICON[t.kind]}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => onDismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const push = useCallback((kind: ToastKind, message: string, duration = 5000) => {
    const id = Date.now() + ++idRef.current;
    setToasts((p) => [...p, { id, kind, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), duration);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  return { toasts, push, dismiss };
}

type EventWithRegistration = GameEvent & {
  is_registered?: boolean;
};

type EventLeaderboardRow = {
  rank: number;
  player_wallet: string;
  war_points: number | null;
  total_draws: number | null;
  total_losses: number | null;
  total_damage_done: number | null;
  total_wins: number | null;
  total_damage_received: number | null;
  player: {
    username: string | null;
    stark_points: number | null;
  } | null;
};

function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatMs(ms: number): string {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function formatMsLabel(ms: number): string {
  if (ms <= 0) return 'Ended';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 24) return 'Starts in days';
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

const RANK_ICONS: Record<number, React.ReactNode> = {
  1: <Crown className="w-4 h-4" style={{ color: '#f59e0b' }} />,
  2: <Medal className="w-4 h-4" style={{ color: '#94a3b8' }} />,
  3: <Medal className="w-4 h-4" style={{ color: '#cd7f32' }} />,
};

const RANK_COLORS: Record<number, string> = {
  1: '#f59e0b',
  2: '#94a3b8',
  3: '#cd7f32',
};

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number.parseInt(params.eventId, 10);
  const now = useNow();

  const { account, address } = useAccount();

  const [event, setEvent] = useState<EventWithRegistration | null>(null);
  const [leaderboard, setLeaderboard] = useState<EventLeaderboardRow[]>([]);
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [showDeckSelector, setShowDeckSelector] = useState(false);
  const [deckAction, setDeckAction] = useState<'join' | null>(null);
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const refreshEvent = async () => {
    const res = await fetch(`/api/events/${eventId}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.event) setEvent(data.event);
  };

  const refreshLeaderboard = async () => {
    const res = await fetch(`/api/events/${eventId}/leaderboard`, { cache: 'no-store' });
    const data = await res.json();
    setLeaderboard(data.leaderboard || []);
  };

  useEffect(() => {
    if (!Number.isFinite(eventId)) return;
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([refreshEvent(), refreshLeaderboard()]);
      } finally {
        setLoading(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (!address) {
      setCards([]);
      return;
    }
    const loadCards = async () => {
      try {
        const response = await fetch(`/api/cards?wallet_address=${address}`);
        const data = await response.json();
        setCards(data.cards || []);
      } catch {
        setCards([]);
      }
    };
    void loadCards();
  }, [address]);

  const state = useMemo(() => {
    if (!event) {
      return {
        hasStarted: false,
        hasEnded: false,
        isConcluded: false,
        canJoin: false,
        canPlayForLeaderboard: false,
      };
    }
    const ts = Date.now();
    const start = new Date(event.starts_at).getTime();
    const end = event.ends_at ? new Date(event.ends_at).getTime() : Number.POSITIVE_INFINITY;
    const hasStarted = ts >= start;
    const hasEnded = ts >= end;
    const isConcluded = event.status === 'Completed' || event.status === 'Cancelled' || hasEnded;
    const canJoin =
      !event.is_registered &&
      event.status === 'Open' &&
      !hasStarted &&
      event.current_players < event.max_players;
    const canPlayForLeaderboard =
      Boolean(event.is_registered) &&
      hasStarted &&
      (event.status === 'Open' || event.status === 'InProgress') &&
      !isConcluded;

    return { hasStarted, hasEnded, isConcluded, canJoin, canPlayForLeaderboard };
  }, [event]);

  const myRank = useMemo(() => {
    if (!address) return null;
    const me = leaderboard.find(
      (row) => row.player_wallet.toLowerCase() === address.toLowerCase()
    );
    if (!me) return null;
    return {
      rank: me.rank,
      warPoints: me.war_points ?? 0,
      wins: me.total_wins ?? 0,
      draws: me.total_draws ?? 0,
      losses: me.total_losses ?? 0,
      damageDone: me.total_damage_done ?? 0,
      damageReceived: me.total_damage_received ?? 0,
      starkPoints: me.player?.stark_points ?? 0,
    };
  }, [address, leaderboard]);

  const timerMs = useMemo(() => {
    if (!event) return 0;
    if (state.isConcluded) return 0;
    if (state.hasStarted && event.ends_at) return new Date(event.ends_at).getTime() - now;
    return new Date(event.starts_at).getTime() - now;
  }, [event, now, state]);

  const phase: 'upcoming' | 'ongoing' | 'concluded' = state.isConcluded
    ? 'concluded'
    : state.hasStarted
    ? 'ongoing'
    : 'upcoming';

  const phaseAccent =
    phase === 'ongoing' ? '#f59e0b' : phase === 'upcoming' ? '#38bdf8' : 'var(--text-muted)';
  const phaseGlow =
    phase === 'ongoing'
      ? 'rgba(245,158,11,0.16)'
      : phase === 'upcoming'
      ? 'rgba(56,189,248,0.14)'
      : 'rgba(100,100,100,0.06)';
  const phaseBorder =
    phase === 'ongoing'
      ? 'rgba(245,158,11,0.35)'
      : phase === 'upcoming'
      ? 'rgba(56,189,248,0.3)'
      : 'rgba(100,100,100,0.18)';

  const joinEventOnChain = async (
    onChainEventId: bigint,
    entryFee: bigint,
    deck: [bigint, bigint, bigint]
  ): Promise<string> => {
    if (!account) throw new Error('No account connected');

    const tx = await account.execute([
      {
        contractAddress: STRK_TOKEN_ADDRESS,
        entrypoint: 'approve',
        calldata: CallData.compile([ESCROW_SYSTEM_ADDRESS, cairo.uint256(entryFee)]),
      },
      {
        contractAddress: ESCROW_SYSTEM_ADDRESS,
        entrypoint: 'deposit_stake',
        calldata: CallData.compile([cairo.uint256(entryFee)]),
      },
      {
        contractAddress: EVENT_SYSTEM_ADDRESS,
        entrypoint: 'join_event',
        calldata: CallData.compile([onChainEventId, deck[0], deck[1], deck[2]]),
      },
    ]);

    await account.waitForTransaction(tx.transaction_hash, {
      retryInterval: 2000,
      successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
    });

    return tx.transaction_hash;
  };

  const completeJoin = async (selectedCards: PlayerCard[]) => {
    if (!event) return;
    const deck: [bigint, bigint, bigint] = [
      BigInt(selectedCards[0].id),
      BigInt(selectedCards[1].id),
      BigInt(selectedCards[2].id),
    ];

    if (!account) {
      pushToast('warning', 'Connect your wallet to join the event.');
      return;
    }

    setJoining(true);

    try {
      // ------------------------------------------------------------------
      // Phase 1 — Pre-flight: validate eligibility, get on-chain event id
      // ------------------------------------------------------------------
      const preRes = await fetch('/api/events/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: event.event_id }),
      });
      const preData = await preRes.json();

      if (preData.error) {
        pushToast('error', preData.error);
        return;
      }

      const onChainEventId = preData?.contract_call?.event_id ?? event.on_chain_id ?? null;
      if (!onChainEventId) {
        pushToast('error', 'Server did not return an on-chain event id.');
        return;
      }

      const entryFee = BigInt(preData?.contract_call?.entry_fee ?? event.entry_fee);

      // ------------------------------------------------------------------
      // Phase 2 — On-chain: approve → deposit_stake → join_event
      // Tokens are transferred NOW, before any DB record is created.
      // ------------------------------------------------------------------
      const txHash = await joinEventOnChain(BigInt(onChainEventId), entryFee, deck);

      // ------------------------------------------------------------------
      // Phase 3 — Confirm: tell the server the tx succeeded so it writes DB
      // ------------------------------------------------------------------
      const confirmRes = await fetch('/api/events/join/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: event.event_id, tx_hash: txHash }),
      });
      const confirmData = await confirmRes.json();

      if (confirmData.error) {
        pushToast('warning', `Payment sent (tx: ${txHash.slice(0, 12)}…), but confirmation pending. Refresh shortly.`, 8000);
        return;
      }

      await Promise.all([refreshEvent(), refreshLeaderboard()]);
      pushToast('success', 'Registration complete — you are in the war zone!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to join event.';
      pushToast('error', message);
    } finally {
      setJoining(false);
    }
  };

  const handleDeckConfirm = async (selectedCards: PlayerCard[]) => {
    setShowDeckSelector(false);
    if (deckAction === 'join') {
      await completeJoin(selectedCards);
    }
    setDeckAction(null);
  };

  const openDeckSelector = (action: 'join') => {
    if (!account) {
      pushToast('warning', 'Connect your wallet first.');
      return;
    }
    if (cards.length < 3) {
      pushToast('warning', 'You need at least 3 cards to enter.');
      return;
    }
    setDeckAction(action);
    setShowDeckSelector(true);
  };

  const handlePlayMatch = () => {
    if (!event) return;
    const rounds = event.total_rounds;
    router.push(`/lobby?mode=ranked&rounds=${rounds}&from_event=${event.event_id}`);
  };

  if (!Number.isFinite(eventId)) {
    return <div className="p-6 text-[var(--text-primary)]">Invalid event.</div>;
  }

  if (loading || !event) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="space-y-4 w-full max-w-6xl">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl"
              style={{ background: 'var(--bg-panel)', animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const playerPct = Math.min((event.current_players / event.max_players) * 100, 100);

  return (
    <div className="min-h-screen p-4 md:p-8 text-[var(--text-primary)]">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Back nav */}
        <motion.button
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => router.push('/events')}
          className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <ChevronLeft className="w-4 h-4" />
          War Zone Events
        </motion.button>

        {/* Hero banner */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden p-6 md:p-8"
          style={{
            background: 'var(--bg-panel)',
            border: `1px solid ${phaseBorder}`,
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="absolute top-0 right-0 w-64 h-32 rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ background: phaseAccent }}
          />
          <div
            className="absolute top-0 left-1/3 w-48 h-24 rounded-full opacity-10 blur-3xl pointer-events-none"
            style={{ background: 'var(--accent-primary)' }}
          />

          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-[0.18em] uppercase mb-3"
                  style={{ color: phaseAccent, background: phaseGlow, border: `1px solid ${phaseBorder}` }}
                >
                  {phase === 'ongoing' && (
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: phaseAccent }} />
                  )}
                  {phase === 'ongoing' ? 'LIVE' : phase === 'upcoming' ? 'UPCOMING' : 'CONCLUDED'}
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">
                  {event.event_name}
                </h1>
              </div>

              {!state.isConcluded && timerMs > 0 && (
                <motion.div
                  animate={phase === 'ongoing' ? { scale: [1, 1.02, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-center"
                  style={{
                    background: phaseGlow,
                    border: `1px solid ${phaseBorder}`,
                    borderRadius: '1rem',
                    padding: '0.75rem 1.25rem',
                  }}
                >
                  <p className="text-[9px] font-bold tracking-[0.2em] uppercase mb-1" style={{ color: phaseAccent }}>
                    {phase === 'ongoing' ? 'Time Remaining' : 'Starts In'}
                  </p>
                  <p className="font-mono font-black text-2xl tabular-nums" style={{ color: phaseAccent }}>
                    {formatMs(timerMs)}
                  </p>
                </motion.div>
              )}

              {state.isConcluded && (
                <div
                  className="text-center px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(100,100,100,0.06)', border: '1px solid rgba(100,100,100,0.18)' }}
                >
                  <Trophy className="w-8 h-8 mx-auto mb-1 opacity-40" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">Tournament Over</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { label: 'Entry Fee', value: `${formatStrk(event.entry_fee)} STRK`, icon: Target },
                { label: 'Prize Pool', value: `${formatStrk(event.prize_pool)} STRK`, icon: Trophy, accent: '#f59e0b' },
                { label: 'Players', value: `${event.current_players}/${event.max_players}`, icon: Users },
                { label: 'SP Reward', value: String(event.sp_reward), icon: Star, accent: '#f59e0b' },
              ].map(({ label, value, icon: Icon, accent }) => (
                <div
                  key={label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-base)' }}
                >
                  <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: accent ?? 'var(--text-muted)' }} />
                  <p className="font-black text-base text-[var(--text-primary)]">{value}</p>
                  <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${playerPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  style={{ background: phaseAccent }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* My rank sticky banner */}
        <AnimatePresence>
          {myRank && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl border px-5 py-3 flex flex-wrap items-center gap-4"
              style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.35)' }}
            >
              <div className="flex items-center gap-2">
                {RANK_ICONS[myRank.rank] ?? <TrendingUp className="w-4 h-4" style={{ color: '#f59e0b' }} />}
                <span className="font-black text-lg" style={{ color: '#f59e0b' }}>#{myRank.rank}</span>
              </div>
              <div className="h-4 w-px bg-[var(--border-base)]" />
              {[
                { label: 'Pts', value: myRank.warPoints },
                { label: 'W', value: myRank.wins },
                { label: 'D', value: myRank.draws },
                { label: 'L', value: myRank.losses },
                { label: 'DD', value: myRank.damageDone },
                { label: 'DR', value: myRank.damageReceived },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="font-bold text-sm text-[var(--text-primary)]">{value}</p>
                  <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
                </div>
              ))}
              <div className="ml-auto flex items-center gap-1 text-xs">
                <Image src="/assets/icons/sp-icon.png" alt="SP" width={18} height={18} className="shrink-0 opacity-70" />
                <span className="font-bold text-[var(--text-primary)]">{myRank.starkPoints}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

          {/* Leaderboard */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-base)', backdropFilter: 'blur(16px)' }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border-base)', background: 'var(--bg-secondary)' }}
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4" style={{ color: '#f59e0b' }} />
                <h2 className="font-black text-lg text-[var(--text-primary)]">Leaderboard</h2>
                {leaderboard.length > 0 && (
                  <span
                    className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-base)' }}
                  >
                    {leaderboard.length} players
                  </span>
                )}
              </div>
              <button
                onClick={() => void refreshLeaderboard()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-base)] hover:bg-[var(--bg-tertiary)]"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>

            {leaderboard.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">No participants yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-base)', background: 'var(--bg-secondary)' }}>
                      {['#', 'Player', 'Pts', 'W', 'D', 'L', 'DD', 'DR', 'SP'].map((h) => (
                        <th
                          key={h}
                          className={`px-3 py-2.5 font-bold uppercase tracking-wider text-[var(--text-muted)] text-[9px] ${h === 'Player' ? 'text-left' : 'text-right'}`}
                        >
                          {h === 'SP' ? (
                            <span className="flex items-center justify-end gap-1">
                              <Image src="/assets/icons/sp-icon.png" alt="SP" width={10} height={10} className="shrink-0 opacity-60" />
                            </span>
                          ) : h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row, i) => {
                      const isMe = address && row.player_wallet.toLowerCase() === address.toLowerCase();
                      const rankColor = RANK_COLORS[row.rank];
                      return (
                        <motion.tr
                          key={`${row.player_wallet}-${row.rank}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          style={{
                            borderBottom: '1px solid var(--border-base)',
                            background: isMe
                              ? 'rgba(245,158,11,0.06)'
                              : row.rank <= 3
                              ? `${RANK_COLORS[row.rank]}06`
                              : 'transparent',
                          }}
                        >
                          <td className="px-3 py-2.5 w-8">
                            {RANK_ICONS[row.rank] ? (
                              <span style={{ color: rankColor }}>{RANK_ICONS[row.rank]}</span>
                            ) : (
                              <span className="font-bold text-[var(--text-muted)]">{row.rank}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 max-w-[140px]">
                            <div className="flex items-center gap-1.5">
                              {isMe && (
                                <span
                                  className="text-[8px] font-bold tracking-wider px-1 py-0.5 rounded"
                                  style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.12)' }}
                                >
                                  YOU
                                </span>
                              )}
                              <span
                                className="font-semibold truncate"
                                style={{ color: isMe ? '#f59e0b' : rankColor ?? 'var(--text-primary)' }}
                              >
                                {row.player?.username || row.player_wallet.slice(0, 10) + '…'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-black" style={{ color: rankColor ?? 'var(--text-primary)' }}>
                            {row.war_points ?? 0}
                          </td>
                          <td className="px-3 py-2.5 text-right text-[var(--text-primary)]">{row.total_wins ?? 0}</td>
                          <td className="px-3 py-2.5 text-right text-[var(--text-muted)]">{row.total_draws ?? 0}</td>
                          <td className="px-3 py-2.5 text-right text-[#f87171]">{row.total_losses ?? 0}</td>
                          <td className="px-3 py-2.5 text-right text-[var(--text-muted)]">{row.total_damage_done ?? 0}</td>
                          <td className="px-3 py-2.5 text-right text-[var(--text-muted)]">{row.total_damage_received ?? 0}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="flex items-center justify-end gap-1">
                              <Image src="/assets/icons/sp-icon.png" alt="SP" width={10} height={10} className="shrink-0 opacity-60" />
                              <span className="text-[var(--text-muted)]">{row.player?.stark_points ?? 0}</span>
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.section>

          {/* Action Sidebar */}
          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="space-y-4"
          >
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-base)', backdropFilter: 'blur(16px)' }}
            >
              <h2 className="font-black text-base text-[var(--text-primary)] flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: phaseAccent }} />
                Event Details
              </h2>
              {[
                { label: 'Start', value: new Date(event.starts_at).toLocaleString() },
                { label: 'End', value: event.ends_at ? new Date(event.ends_at).toLocaleString() : 'TBD' },
                { label: 'Rounds', value: String(event.total_rounds) },
                { label: 'Players', value: `${event.current_players} / ${event.max_players}` },
                { label: 'Prize Pool', value: `${formatStrk(event.prize_pool)} STRK` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-3 text-xs">
                  <span className="uppercase tracking-wider text-[var(--text-muted)] shrink-0">{label}</span>
                  <span className="font-semibold text-[var(--text-primary)] text-right">{value}</span>
                </div>
              ))}
            </div>

            {event.is_registered && !state.isConcluded && (
              <div
                className="rounded-xl px-4 py-3 flex items-center gap-2 text-xs"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)' }}
              >
                <span className="w-2 h-2 rounded-full shrink-0 bg-[#34d399]" />
                <span className="font-semibold text-[#34d399] tracking-wider uppercase">You are registered</span>
              </div>
            )}

            {state.canJoin && (
              <button
                onClick={() => openDeckSelector('join')}
                disabled={joining}
                className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition flex items-center justify-center gap-2"
                style={{
                  background: '#38bdf8',
                  color: '#000',
                  opacity: joining ? 0.6 : 1,
                  boxShadow: '0 0 24px rgba(56,189,248,0.25)',
                }}
              >
                <Target className="w-4 h-4" />
                {joining ? 'Joining…' : 'Register Now'}
              </button>
            )}

            {!state.canJoin && !event.is_registered && !state.isConcluded && (
              <div
                className="rounded-xl px-4 py-3 text-xs text-[var(--text-muted)] tracking-wider"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-base)' }}
              >
                Registration is closed for this event.
              </div>
            )}

            {/* ENTER BATTLE — only when active && canPlay, removed entirely for concluded */}
            {!state.isConcluded && state.canPlayForLeaderboard && (
              <motion.button
                onClick={handlePlayMatch}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                animate={{ boxShadow: ['0 0 20px rgba(245,158,11,0.3)', '0 0 40px rgba(245,158,11,0.6)', '0 0 20px rgba(245,158,11,0.3)'] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                className="w-full py-4 rounded-xl font-black text-base tracking-wide flex items-center justify-center gap-3"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff' }}
              >
                <Swords className="w-5 h-5" />
                ENTER BATTLE
                <Zap className="w-4 h-4 animate-pulse" />
              </motion.button>
            )}

            {/* Concluded: no play button */}
            {state.isConcluded && (
              <div
                className="rounded-xl p-4 text-center space-y-2"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-base)' }}
              >
                <Trophy className="w-8 h-8 mx-auto opacity-30" style={{ color: 'var(--text-muted)' }} />
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Tournament concluded</p>
                <p className="text-[10px] text-[var(--text-muted)]">Final rankings are above.</p>
              </div>
            )}

            {!state.isConcluded && event.is_registered && !state.canPlayForLeaderboard && !state.hasStarted && (
              <div
                className="rounded-xl px-4 py-3 text-xs text-[var(--text-muted)] tracking-wider"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-base)' }}
              >
                <Clock className="w-3.5 h-3.5 inline mr-1.5" />
                Event starts {formatMsLabel(timerMs)}.
              </div>
            )}
          </motion.aside>
        </div>
      </div>

      {showDeckSelector && (
        <CardSelector
          cards={cards}
          maxSelection={3}
          title={deckAction === 'join' ? 'Select Deck For Event Registration' : 'Select Deck'}
          onConfirm={handleDeckConfirm}
          onCancel={() => {
            setShowDeckSelector(false);
            setDeckAction(null);
          }}
        />
      )}
    </div>
  );
}
