'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAccount } from '@starknet-react/core';
import type { Room, RoomMember, RoomFixture, RoomStanding, PlayerCard } from '@/src/types/database';
import { formatStrk } from '@/src/lib/cartridge/utils';
import { Copy, AlertTriangle, Clock, Trophy, Send, Key, Users, Sword, ChevronDown, ChevronUp, CheckCircle, XCircle, Zap, Shield, Crown } from 'lucide-react';
import { CardSelector } from '@/src/components/cards/CardSelector';
import { buildMatchPath } from '@/src/lib/matches/url';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Toast system ─────────────────────────────────────────────────────── */
type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; message: string };

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={() => onDismiss(t.id)}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl cursor-pointer min-w-[260px] max-w-[360px]"
            style={{
              background: t.kind === 'success' ? 'rgba(16,185,129,0.18)' : t.kind === 'error' ? 'rgba(239,68,68,0.18)' : 'rgba(99,102,241,0.18)',
              border: `1px solid ${t.kind === 'success' ? 'rgba(16,185,129,0.4)' : t.kind === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(99,102,241,0.4)'}`,
              backdropFilter: 'blur(16px)',
            }}
          >
            {t.kind === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> : t.kind === 'error' ? <XCircle className="w-4 h-4 text-red-400 shrink-0" /> : <Zap className="w-4 h-4 text-indigo-400 shrink-0" />}
            <span className="text-sm text-[var(--text-primary)]">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const push = useCallback((kind: ToastKind, message: string, duration = 4000) => {
    const id = ++counter.current;
    setToasts((p) => [...p, { id, kind, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), duration);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  return { toasts, push, dismiss };
}

type RoomPayload = {
  room: Room;
  members: Array<RoomMember & { username?: string | null }>;
  fixtures: Array<RoomFixture & { player_a_username?: string | null; player_b_username?: string | null }>;
  standings: Array<RoomStanding & { username?: string | null }>;
};

/* ─── helpers ──────────────────────────────────────────────────────────── */
function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatGrace(ms: number): string {
  if (ms <= 0) return 'Expiring…';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m left`;
}

function shortAddr(w: string) {
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

/* ─── skeleton loader ───────────────────────────────────────────────────── */
function RoomSkeleton() {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-40 rounded-2xl animate-pulse"
            style={{ background: 'var(--bg-panel)', animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── main component ────────────────────────────────────────────────────── */
export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const { address } = useAccount();
  const { toasts, push, dismiss } = useToasts();

  const [data, setData] = useState<RoomPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [showDeckSelector, setShowDeckSelector] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [queueSince, setQueueSince] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeMessage, setDisputeMessage] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeSent, setDisputeSent] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  const roomIdOrCode = params?.roomId;

  /* ── live clock ── */
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ── fetch room ── */
  const fetchRoom = useCallback(async () => {
    if (!roomIdOrCode) return;
    try {
      const res = await fetch(`/api/rooms/${roomIdOrCode}`, { cache: 'no-store' });
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const payload = await res.json();
      setData(payload);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [roomIdOrCode]);

  useEffect(() => { void fetchRoom(); }, [fetchRoom]);

  /* polling */
  useEffect(() => {
    if (!data?.room?.room_id) return;
    const id = setInterval(() => void fetchRoom(), 6000);
    return () => clearInterval(id);
  }, [data?.room?.room_id, fetchRoom]);

  /* ── player cards ── */
  useEffect(() => {
    if (!address) return;
    fetch(`/api/cards?wallet_address=${address}`)
      .then((r) => r.json())
      .then((p) => setCards(p.cards || []))
      .catch(() => undefined);
  }, [address]);

  /* ── queue polling for match ── */
  useEffect(() => {
    if (!queueing) return;
    let stop = false;
    const id = setInterval(async () => {
      try {
        const qs = new URLSearchParams();
        if (queueSince) qs.set('since', queueSince);
        if (data?.room?.room_id) qs.set('room_context_id', String(data.room.room_id));
        if (data?.room?.total_rounds) qs.set('total_rounds', String(data.room.total_rounds));
        const res = await fetch(`/api/matches/queue/status?${qs.toString()}`, { cache: 'no-store' });
        const p = await res.json();
        if (stop) return;
        if (p?.match?.match_id) {
          setQueueing(false);
          setQueueSince(null);
          router.push(buildMatchPath(p.match.match_id, p.match.created_at));
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [data?.room?.room_id, data?.room?.total_rounds, queueSince, queueing, router]);

  /* ── derived timers ── */
  const decayMs = useMemo(() => {
    if (!data?.room?.decay_at) return 0;
    return Math.max(0, new Date(data.room.decay_at).getTime() - nowMs);
  }, [data?.room?.decay_at, nowMs]);

  const graceMs = useMemo(() => {
    if (!data?.room?.destroy_after) return 0;
    return Math.max(0, new Date(data.room.destroy_after).getTime() - nowMs);
  }, [data?.room?.destroy_after, nowMs]);

  /* ── dispute availability: only available in the 24hr grace window ── */
  const inGracePeriod = useMemo(() => {
    if (!data?.room) return false;
    const isConcluded = data.room.status === 'Completed' || data.room.status === 'Expired';
    return isConcluded && graceMs > 0;
  }, [data?.room, graceMs]);

  /* ── dispute already-sent check (localStorage) ── */
  const disputeStorageKey = data?.room?.room_id ? `dispute_sent_room_${data.room.room_id}` : null;
  useEffect(() => {
    if (!disputeStorageKey) return;
    if (localStorage.getItem(disputeStorageKey) === '1') {
      setDisputeSent(true);
    }
  }, [disputeStorageKey]);

  /* ── actions ── */
  const copyKey = async () => {
    if (!data?.room?.room_code) return;
    try {
      await navigator.clipboard.writeText(data.room.room_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      push('success', 'Room Key copied to clipboard!');
    } catch { /* ignore */ }
  };

  const submitDispute = async () => {
    if (!data?.room?.room_code || !disputeMessage.trim()) return;
    setDisputeSubmitting(true);
    try {
      const res = await fetch('/api/rooms/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: data.room.room_code, message: disputeMessage.trim() }),
      });
      const payload = await res.json();
      if (payload.error) {
        push('error', payload.error);
        // if already submitted, treat as sent
        if (res.status === 409) {
          setDisputeSent(true);
          if (disputeStorageKey) localStorage.setItem(disputeStorageKey, '1');
        }
      } else {
        setDisputeSent(true);
        setDisputeMessage('');
        if (disputeStorageKey) localStorage.setItem(disputeStorageKey, '1');
        push('success', 'Dispute submitted. An admin will review and reply to your inbox.');
      }
    } catch {
      push('error', 'Failed to submit dispute. Please try again.');
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const queueFromRoom = async (selectedCards: PlayerCard[]) => {
    if (!data?.room) return;
    try {
      const res = await fetch('/api/matches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_type: 'ranked',
          deck: selectedCards.map((c) => c.id),
          total_rounds: data.room.total_rounds,
          room_context_id: data.room.room_id,
        }),
      });
      const payload = await res.json();
      if (payload?.error) { push('error', payload.error); return; }
      if (payload?.match?.match_id) {
        router.push(buildMatchPath(payload.match.match_id, payload.match.created_at));
        return;
      }
      if (payload?.queued) {
        setQueueSince(payload.queued_since ?? new Date().toISOString());
        setQueueing(true);
        push('info', 'Searching for an opponent…');
      }
    } catch {
      push('error', 'Failed to queue room match. Please try again.');
    }
  };

  /* ── loading / not-found states ── */
  if (loading) return <RoomSkeleton />;

  if (notFound || !data?.room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-base)' }}>
            <AlertTriangle className="w-9 h-9 text-[var(--text-muted)] opacity-50" />
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">Room No Longer Exists</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            This room has been permanently removed — either it was never created or its grace period has expired.
          </p>
          <button
            onClick={() => router.push('/lobby')}
            className="px-6 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: 'var(--accent-primary)', color: '#000' }}
          >
            Back to Lobby
          </button>
        </motion.div>
      </div>
    );
  }

  /* ── derived vars ── */
  const { room, members, fixtures, standings } = data;
  const selfWallet = address?.toLowerCase() ?? '';
  const selfStanding = standings.find((s) => s.player_wallet?.toLowerCase() === selfWallet);
  const selfGamesPlayed = (selfStanding?.wins ?? 0) + (selfStanding?.losses ?? 0) + (selfStanding?.draws ?? 0);
  const isHost = Boolean(address && room.host_wallet?.toLowerCase() === address.toLowerCase());
  const winnerMember = members.find((m) => m.status === 'Winner');
  const isSettled = room.status === 'Completed' || room.status === 'Expired';
  const isActive = room.status === 'Open' || room.status === 'InProgress';

  const phaseAccent = isActive ? '#f59e0b' : isSettled ? '#64748b' : '#38bdf8';
  const phaseBorder = isActive ? 'rgba(245,158,11,0.35)' : 'rgba(100,116,139,0.3)';

  const playerPct = Math.min((room.current_players / room.max_players) * 100, 100);

  /* ─── render ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen p-4 md:p-8 text-[var(--text-primary)]">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── Hero header ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl p-6 md:p-8"
          style={{ background: 'var(--bg-panel)', border: `1px solid ${phaseBorder}` }}
        >
          {/* ambient glow */}
          <div
            className="absolute -top-10 -right-10 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{ background: phaseAccent }}
          />
          {/* top strip */}
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: phaseAccent }} />

          {/* Grace period danger banner */}
          <AnimatePresence>
            {inGracePeriod && graceMs > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)' }}
              >
                <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                </motion.div>
                <div className="text-sm">
                  <span className="text-red-300 font-bold">Grace Period: </span>
                  <span className="text-red-200">{formatGrace(graceMs)} remaining — file disputes before this room is permanently removed.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* title row */}
          <div className="flex items-start justify-between flex-wrap gap-4 relative z-10">
            <div>
              {/* Phase badge */}
              <div className="flex items-center gap-2 mb-2">
                <motion.div
                  animate={isActive ? { opacity: [1, 0.5, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-[0.18em] uppercase"
                  style={{ color: phaseAccent, background: `${phaseAccent}18`, border: `1px solid ${phaseBorder}` }}
                >
                  {isActive && <span className="w-1.5 h-1.5 rounded-full mr-1.5 inline-block animate-pulse" style={{ background: phaseAccent }} />}
                  {room.status}
                </motion.div>
                <span className="text-[10px] text-[var(--text-muted)] capitalize">{room.visibility}</span>
              </div>
              <h1 className="font-black text-3xl md:text-4xl text-[var(--text-primary)]">
                Room {room.room_code}
              </h1>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={copyKey}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
                style={{
                  background: copied ? 'rgba(16,185,129,0.18)' : 'var(--bg-secondary)',
                  border: copied ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--border-base)',
                  color: copied ? '#34d399' : 'var(--text-primary)',
                }}
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Key'}
              </motion.button>
              <button
                onClick={() => router.push('/lobby')}
                className="px-4 py-2 rounded-xl text-sm transition"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-base)', color: 'var(--text-muted)' }}
              >
                ← Lobby
              </button>
            </div>
          </div>

          {/* Room Key display */}
          <div
            className="mt-5 inline-flex items-center gap-3 px-5 py-3 rounded-2xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-accent)' }}
          >
            <Key className="w-5 h-5 shrink-0" style={{ color: phaseAccent }} />
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-0.5">Room Key</p>
              <p className="font-mono font-black text-xl tracking-[0.3em] text-[var(--text-primary)]">{room.room_code}</p>
            </div>
          </div>

          {/* Live countdown OR winner banner */}
          {isActive && decayMs > 0 ? (
            <div className="mt-5 flex items-center gap-3">
              <Clock className="w-5 h-5 shrink-0" style={{ color: phaseAccent }} />
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Time Remaining</p>
                <motion.p
                  key={formatCountdown(decayMs)}
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 1 }}
                  className="font-mono font-black text-2xl tabular-nums"
                  style={{ color: decayMs < 3600000 ? '#ef4444' : phaseAccent }}
                >
                  {formatCountdown(decayMs)}
                </motion.p>
              </div>
            </div>
          ) : isSettled && winnerMember ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              <Crown className="w-7 h-7 text-yellow-400 shrink-0" />
              <div className="flex-1">
                <p className="text-[9px] uppercase tracking-wider text-yellow-500 mb-0.5">Room Winner</p>
                <p className="font-black text-lg text-yellow-300">
                  {(winnerMember as { username?: string | null }).username?.trim() || shortAddr(winnerMember.player_wallet)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Payout</p>
                <p className="font-bold text-emerald-300">{formatStrk(room.winner_payout || '0')} STRK</p>
                <p className="text-[9px] text-[var(--text-muted)]">Treasury: {formatStrk(room.treasury_fee || '0')} STRK</p>
              </div>
            </motion.div>
          ) : null}

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            {[
              { label: 'Players', value: `${room.current_players}/${room.max_players}`, icon: Users },
              { label: 'Entry Fee', value: `${formatStrk(room.stake_fee)} STRK`, icon: Shield },
              { label: 'Prize Pool', value: `${formatStrk(room.prize_pool)} STRK`, icon: Trophy },
              { label: 'Rounds/Match', value: room.total_rounds, icon: Sword },
              { label: 'Your Games', value: `${selfGamesPlayed}/${room.matches_per_player ?? '-'}`, icon: Zap },
            ].map(({ label, value, icon: Icon }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.06 }}
                className="rounded-xl p-3 text-center"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-base)' }}
              >
                <Icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: phaseAccent }} />
                <p className="font-black text-sm text-[var(--text-primary)]">{value}</p>
                <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
              </motion.div>
            ))}
          </div>

          {/* Player fill bar */}
          <div className="mt-4">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${playerPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: phaseAccent }}
              />
            </div>
          </div>

          {/* Action buttons row */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {isHost && room.status === 'Open' && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={async () => {
                  await fetch(`/api/rooms/${room.room_id}/start`, { method: 'POST' });
                  push('success', 'Room started!');
                  setLoading(true);
                  await fetchRoom();
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff' }}
              >
                ⚡ Start Room
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowDeckSelector(true)}
              disabled={room.status !== 'InProgress' || queueing}
              className="px-5 py-2.5 rounded-xl font-bold text-sm transition"
              style={{
                background: room.status === 'InProgress' && !queueing
                  ? 'linear-gradient(135deg,#f59e0b,#ef4444)'
                  : 'var(--bg-secondary)',
                color: room.status === 'InProgress' && !queueing ? '#fff' : 'var(--text-muted)',
                border: room.status !== 'InProgress' || queueing ? '1px solid var(--border-base)' : 'none',
                cursor: room.status !== 'InProgress' || queueing ? 'not-allowed' : 'pointer',
              }}
            >
              {queueing ? (
                <span className="flex items-center gap-2">
                  <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full" />
                  Searching…
                </span>
              ) : (
                '⚔ Queue Room Match'
              )}
            </motion.button>
            {queueing && (
              <button
                onClick={async () => {
                  await fetch('/api/matches/queue/cancel', { method: 'POST' });
                  setQueueing(false);
                  setQueueSince(null);
                  push('info', 'Queue cancelled.');
                }}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-base)', color: 'var(--text-muted)' }}
              >
                Cancel Search
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Members + Standings ───────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-5">

          {/* Members */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-5"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-base)' }}
          >
            <h2 className="font-black text-lg mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: phaseAccent }} />
              Members
            </h2>
            <div className="space-y-2">
              {members.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No members yet.</p>
              ) : members.map((m, i) => {
                const isSelf = m.player_wallet?.toLowerCase() === selfWallet;
                const isWinner = m.status === 'Winner';
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.05 }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{
                      background: isSelf ? 'rgba(245,158,11,0.06)' : 'var(--bg-secondary)',
                      border: `1px solid ${isSelf ? 'rgba(245,158,11,0.2)' : 'var(--border-base)'}`,
                    }}
                  >
                    <span className="text-sm text-[var(--text-primary)]">
                      {isWinner && <Crown className="w-3.5 h-3.5 text-yellow-400 inline mr-1.5 mb-0.5" />}
                      {(m as { username?: string | null }).username?.trim() || shortAddr(m.player_wallet)}
                      {isSelf && <span className="ml-1.5 text-[9px] font-bold text-yellow-400 uppercase tracking-wide">YOU</span>}
                    </span>
                    <span className={`text-xs font-semibold ${isWinner ? 'text-yellow-400' : 'text-[var(--text-muted)]'}`}>
                      {m.status}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Standings */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl p-5"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-base)' }}
          >
            <h2 className="font-black text-lg mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4" style={{ color: phaseAccent }} />
              Standings
            </h2>
            <div className="space-y-2">
              {standings.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No standings yet.</p>
              ) : standings.map((s, idx) => {
                const isSelf = s.player_wallet?.toLowerCase() === selfWallet;
                const isFirst = idx === 0;
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + idx * 0.05 }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{
                      background: isSelf ? 'rgba(245,158,11,0.06)' : 'var(--bg-secondary)',
                      border: `1px solid ${isSelf ? 'rgba(245,158,11,0.2)' : 'var(--border-base)'}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${isFirst ? 'bg-yellow-400 text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}>
                        {idx + 1}
                      </span>
                      <span className="text-sm text-[var(--text-primary)]">
                        {(s as { username?: string | null }).username?.trim() || shortAddr(s.player_wallet)}
                        {isSelf && <span className="ml-1.5 text-[9px] font-bold text-yellow-400 uppercase tracking-wide">YOU</span>}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                      <span className="text-[var(--text-primary)] font-bold">{s.points}</span>pts · {s.wins}W-{s.losses}L-{s.draws}D
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* ── Game Results ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-5"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-base)' }}
        >
          <h2 className="font-black text-lg mb-4 flex items-center gap-2">
            <Sword className="w-4 h-4" style={{ color: phaseAccent }} />
            Game Results
          </h2>
          <div className="space-y-2">
            {fixtures.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No room-context games yet.</p>
            ) : fixtures.map((f, i) => (
              <motion.div
                key={f.fixture_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-base)' }}
              >
                <div className="text-sm text-[var(--text-primary)]">
                  <span className="text-[var(--text-muted)] text-xs mr-2">R{f.round_number}</span>
                  <span>{f.player_a_username?.trim() || shortAddr(f.player_a)}</span>
                  <span className="mx-2 text-[var(--text-muted)]">vs</span>
                  <span>{f.player_b ? (f.player_b_username?.trim() || shortAddr(f.player_b)) : '?'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">{f.status}</span>
                  {f.match_id && (
                    <button
                      onClick={() => router.push(`/match/${f.match_id}`)}
                      className="px-3 py-1 rounded-lg text-xs font-bold"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                    >
                      View
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Room Dispute (collapsible, grace period only) ─────────────── */}
        <AnimatePresence>
          {(inGracePeriod || disputeSent) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-panel)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              {/* Header / toggle */}
              <button
                onClick={() => setDisputeOpen((p) => !p)}
                disabled={disputeSent}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                style={{ cursor: disputeSent ? 'default' : 'pointer' }}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="font-black text-[var(--text-primary)]">File a Dispute</span>
                  {!disputeSent && inGracePeriod && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                      Grace Period Active
                    </span>
                  )}
                  {disputeSent && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
                      style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                      Submitted
                    </span>
                  )}
                </div>
                {!disputeSent && (
                  disputeOpen ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </button>

              {/* Expanded form */}
              <AnimatePresence>
                {disputeOpen && !disputeSent && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-5 pb-5 space-y-3"
                  >
                    <p className="text-sm text-[var(--text-muted)]">
                      Describe the issue. Room Key{' '}
                      <span className="font-mono font-bold text-[var(--text-primary)]">{room.room_code}</span>{' '}
                      will be attached automatically. You can only submit one dispute per room.
                    </p>
                    <textarea
                      value={disputeMessage}
                      onChange={(e) => setDisputeMessage(e.target.value)}
                      placeholder="Describe what went wrong (min 10 characters)…"
                      rows={4}
                      maxLength={2000}
                      className="w-full px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none focus:ring-2"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-base)',
                        color: 'var(--text-primary)',
                        caretColor: 'var(--accent-primary)',
                      }}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] text-[var(--text-muted)]">{disputeMessage.length}/2000</span>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={submitDispute}
                        disabled={disputeSubmitting || disputeMessage.trim().length < 10}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition"
                        style={{
                          background: disputeSubmitting || disputeMessage.trim().length < 10
                            ? 'var(--bg-tertiary)' : 'rgba(239,68,68,0.18)',
                          color: disputeSubmitting || disputeMessage.trim().length < 10
                            ? 'var(--text-muted)' : '#f87171',
                          border: '1px solid rgba(239,68,68,0.3)',
                          cursor: disputeSubmitting || disputeMessage.trim().length < 10 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <Send className="w-3.5 h-3.5" />
                        {disputeSubmitting ? 'Submitting…' : 'Submit Dispute'}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
                {disputeSent && disputeOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="px-5 pb-5"
                  >
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <p className="text-sm text-emerald-300">Your dispute has been submitted. An admin will review it and reply to your inbox.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Deck selector */}
      {showDeckSelector && (
        <CardSelector
          cards={cards}
          maxSelection={3}
          onConfirm={queueFromRoom}
          onCancel={() => setShowDeckSelector(false)}
          title="Select Deck for Room Match"
        />
      )}
    </div>
  );
}
