'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GameEvent } from '@/src/types/database';
import { formatStrk } from '@/src/lib/cartridge/utils';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Swords, Zap, Clock, Users, Trophy, ChevronRight, Target, Shield } from 'lucide-react';

type EventListItem = GameEvent & {
  is_registered?: boolean;
};

type EventPhase = 'upcoming' | 'ongoing' | 'concluded';

type PhaseCfg = { accent: string; glow: string; border: string; badge: string };

const PHASE_CFG: Record<EventPhase, PhaseCfg> = {
  upcoming:  { accent: '#38bdf8', glow: 'rgba(56,189,248,0.14)',  border: 'rgba(56,189,248,0.3)',  badge: 'UPCOMING' },
  ongoing:   { accent: '#f59e0b', glow: 'rgba(245,158,11,0.16)', border: 'rgba(245,158,11,0.38)', badge: 'LIVE' },
  concluded: { accent: 'var(--text-muted)', glow: 'rgba(100,100,100,0.06)', border: 'rgba(100,100,100,0.18)', badge: 'ENDED' },
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
  if (ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function getEventPhase(event: EventListItem, nowMs: number): EventPhase {
  const startsAtMs = new Date(event.starts_at).getTime();
  const endsAtMs = event.ends_at ? new Date(event.ends_at).getTime() : null;
  const isConcluded = event.status === 'Completed' || event.status === 'Cancelled' || (endsAtMs !== null && nowMs >= endsAtMs);
  if (isConcluded) return 'concluded';
  if (nowMs >= startsAtMs) return 'ongoing';
  return 'upcoming';
}

function EventCard({ event, phase, now, onOpen }: {
  event: EventListItem;
  phase: EventPhase;
  now: number;
  onOpen: () => void;
}) {
  const cfg = PHASE_CFG[phase];
  const playerPct = Math.min((event.current_players / event.max_players) * 100, 100);

  const timerMs = (() => {
    if (phase === 'concluded') return 0;
    const ends = event.ends_at ? new Date(event.ends_at).getTime() : null;
    if (phase === 'ongoing' && ends) return ends - now;
    return new Date(event.starts_at).getTime() - now;
  })();

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      whileHover={{ y: -3 }}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      role="button"
      tabIndex={0}
      aria-label={`${event.event_name} — ${cfg.badge}`}
      className="relative overflow-hidden rounded-2xl cursor-pointer group"
      style={{
        background: 'var(--bg-panel)',
        border: `1px solid ${cfg.border}`,
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Phase-coloured header strip */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: cfg.accent }}
      />

      {/* Ambient glow */}
      <div
        className="absolute top-0 right-0 w-40 h-20 rounded-full pointer-events-none blur-3xl opacity-30"
        style={{ background: cfg.accent }}
      />

      <div className="relative p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-black text-base text-[var(--text-primary)] leading-tight group-hover:text-[var(--accent-primary)] transition">
            {event.event_name}
          </h3>
          <div
            className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-[0.18em] uppercase"
            style={{ color: cfg.accent, background: cfg.glow, border: `1px solid ${cfg.border}` }}
          >
            {phase === 'ongoing' && (
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cfg.accent }} />
            )}
            {cfg.badge}
          </div>
        </div>

        {/* Countdown row */}
        {phase !== 'concluded' && timerMs > 0 && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: cfg.accent }}>
            <Clock className="w-3 h-3 shrink-0" />
            <span className="font-mono font-bold tabular-nums">{formatMs(timerMs)}</span>
            <span className="text-[var(--text-muted)] text-[10px]">
              {phase === 'ongoing' ? 'remaining' : 'until start'}
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Target, label: 'Fee', value: `${formatStrk(event.entry_fee)} STRK` },
            { icon: Trophy, label: 'Pool', value: `${formatStrk(event.prize_pool)} STRK`, accent: '#f59e0b' },
            { icon: Zap, label: 'Rounds', value: String(event.total_rounds) },
          ].map(({ icon: Icon, label, value, accent }) => (
            <div
              key={label}
              className="rounded-xl p-2.5 text-center"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-base)' }}
            >
              <Icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: accent ?? 'var(--text-muted)' }} />
              <p className="font-bold text-[11px] text-[var(--text-primary)] truncate">{value}</p>
              <p className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
            </div>
          ))}
        </div>

        {/* Player fill bar */}
        <div>
          <div className="flex items-center justify-between mb-1 text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{event.current_players}/{event.max_players}</span>
            <span>{Math.round(playerPct)}% full</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${playerPct}%`, background: cfg.accent }} />
          </div>
        </div>

        {/* CTA */}
        {event.is_registered && phase !== 'concluded' && (
          <div
            className="text-[9px] font-bold uppercase tracking-wider text-center py-1 rounded-lg"
            style={{ color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}
          >
            Registered
          </div>
        )}
        <div className="flex items-center justify-end">
          {phase === 'ongoing' ? (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs tracking-wide"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff' }}
            >
              <Swords className="w-3.5 h-3.5" />
              Enter Battle
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </div>
          ) : phase === 'upcoming' ? (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs tracking-wide"
              style={{ background: '#38bdf8', color: '#000' }}
            >
              <Shield className="w-3.5 h-3.5" />
              Register Now
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs tracking-wide border"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border-base)', background: 'var(--bg-tertiary)' }}
            >
              View Results
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export default function EventsPage() {
  const router = useRouter();
  const now = useNow();
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ongoing' | 'upcoming' | 'concluded'>('ongoing');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/events', { cache: 'no-store' });
        const data = await res.json();
        setEvents(data.events || []);
        setError(null);
      } catch {
        setEvents([]);
        setError('Failed to load events. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const grouped = useMemo(() => {
    const nowMs = Date.now();
    const ongoing: EventListItem[] = [];
    const upcoming: EventListItem[] = [];
    const concluded: EventListItem[] = [];
    for (const ev of events) {
      const p = getEventPhase(ev, nowMs);
      if (p === 'ongoing') ongoing.push(ev);
      else if (p === 'upcoming') upcoming.push(ev);
      else concluded.push(ev);
    }
    return { ongoing, upcoming, concluded };
  }, [events]);

  const liveCount = grouped.ongoing.length;

  const tabEvents = grouped[activeTab];

  const TABS: { key: typeof activeTab; label: string; count: number }[] = [
    { key: 'ongoing',   label: 'Live',      count: grouped.ongoing.length },
    { key: 'upcoming',  label: 'Upcoming',  count: grouped.upcoming.length },
    { key: 'concluded', label: 'Concluded', count: grouped.concluded.length },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8 text-[var(--text-primary)]">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* ── Hero header ── */}
        <div className="relative overflow-hidden rounded-2xl p-8" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-base)' }}>
          {/* Ambient orbs */}
          <div className="absolute -top-8 -right-8 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none" style={{ background: '#f59e0b' }} />
          <div className="absolute -bottom-12 left-1/4 w-48 h-48 rounded-full blur-3xl opacity-8 pointer-events-none" style={{ background: 'var(--accent-primary)' }} />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
            <div>
              {liveCount > 0 && (
                <motion.div
                  animate={{ opacity: [1, 0.6, 1] }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3 text-[9px] font-bold tracking-[0.2em] uppercase"
                  style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
                  {liveCount} Battle{liveCount !== 1 ? 's' : ''} Live Now
                </motion.div>
              )}
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  animate={{ rotate: [-8, 8, -8] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                >
                  <Swords className="w-8 h-8" style={{ color: '#f59e0b' }} />
                </motion.div>
                <h1 className="font-black text-4xl md:text-5xl text-[var(--text-primary)]">WAR ZONE</h1>
              </div>
              <p className="text-sm text-[var(--text-muted)] max-w-sm">
                High-stakes tournaments. Fight for glory and rewards.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Image src="/assets/icons/sp-icon.png" alt="SP" width={21} height={21} className="opacity-70" />
              <span className="text-xs text-[var(--text-muted)]">SP earned from events</span>
            </div>
          </div>
        </div>

        {/* ── Tab selector ── */}
        <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-base)' }}>
          {TABS.map(({ key, label, count }) => {
            const active = activeTab === key;
            const accent = key === 'ongoing' ? '#f59e0b' : key === 'upcoming' ? '#38bdf8' : 'var(--text-muted)';
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all"
                style={{
                  background: active ? (key === 'ongoing' ? 'linear-gradient(135deg, #f59e0b22, #ef444422)' : key === 'upcoming' ? 'rgba(56,189,248,0.12)' : 'var(--bg-tertiary)') : 'transparent',
                  color: active ? accent : 'var(--text-muted)',
                  border: active ? `1px solid ${key === 'ongoing' ? 'rgba(245,158,11,0.35)' : key === 'upcoming' ? 'rgba(56,189,248,0.3)' : 'var(--border-base)'}` : '1px solid transparent',
                }}
              >
                {label}
                <span
                  className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px]"
                  style={{ background: active ? (key === 'concluded' ? 'var(--bg-tertiary)' : `${accent}22`) : 'var(--bg-tertiary)', color: active ? accent : 'var(--text-muted)' }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div
            className="rounded-xl p-4 text-center text-sm"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
          >
            {error}
          </div>
        )}

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl"
                style={{ background: 'var(--bg-panel)', animationDelay: `${i * 0.07}s` }}
              />
            ))}
          </div>
        ) : tabEvents.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-base)' }}>
              <Swords className="w-7 h-7 opacity-30" style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {activeTab === 'ongoing' ? 'No battles live right now.' : activeTab === 'upcoming' ? 'No upcoming events scheduled.' : 'No concluded events.'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              {tabEvents.map((event, i) => (
                <motion.div key={event.event_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <EventCard
                    event={event}
                    phase={getEventPhase(event, now)}
                    now={now}
                    onOpen={() => router.push(`/events/${event.event_id}`)}
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
