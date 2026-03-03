'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAccount } from '@starknet-react/core';
import {
  Crown,
  Swords,
  ShoppingBag,
  Bell,
  CalendarClock,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react';
import { ConnectWallet } from '@/src/components/auth/ConnectWallet';
import { formatStrk } from '@/src/lib/cartridge/utils';
import { motion } from 'framer-motion';
type PlayerStats = {
  total_matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  stark_points: number;
  cards_owned: number;
  total_events_joined: number;
};

type RecentMatch = {
  match_id: number;
  mode: 'VsAI' | 'Ranked1v1' | 'WarZone' | 'Room' | 'Challenge';
  winner: string | null;
  player_1: string;
  player_2: string;
  p1_rounds_won: number;
  p2_rounds_won: number;
  total_rounds: number;
  created_at: string;
  ended_at: string | null;
};

type EventSummary = {
  event_id: number;
  event_name: string;
  status: 'Open' | 'InProgress' | 'Completed' | 'Cancelled';
  starts_at: string;
  entry_fee: string;
  is_registered: boolean;
};
export default function PlayCommandCenterPage() {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [unreadInbox, setUnreadInbox] = useState(0);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<EventSummary[]>([]);
  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const [statsRes, rankRes, inboxRes, matchesRes, eventsRes] = await Promise.all([
          fetch(`/api/player/stats?wallet_address=${address}`, { cache: 'no-store' }),
          fetch(`/api/leaderboard?wallet_address=${address}&limit=1`, { cache: 'no-store' }),
          fetch('/api/inbox/count', { cache: 'no-store', credentials: 'include' }),
          fetch(`/api/player/matches?wallet_address=${address}&limit=5`, { cache: 'no-store' }),
          fetch('/api/events', { cache: 'no-store' }),
        ]);

        const [statsData, rankData, inboxData, matchesData, eventsData] = await Promise.all([
          statsRes.json(),
          rankRes.json(),
          (inboxRes.ok ? inboxRes.json() : Promise.resolve({ unread: 0 })).catch(() => ({ unread: 0 })),
          matchesRes.json(),
          eventsRes.json(),
        ]);

        setStats(statsData?.stats ?? null);
        setMyRank(typeof rankData?.my_rank === 'number' ? rankData.my_rank : null);
        setUnreadInbox(typeof inboxData?.unread === 'number' ? inboxData.unread : 0);
        setRecentMatches(matchesData?.matches ?? []);

        // Only show events the player has registered for and are currently active
        const events = (eventsData?.events ?? []) as EventSummary[];
        const active = events.filter(
          (e) => e.is_registered && (e.status === 'Open' || e.status === 'InProgress'),
        );
        setRegisteredEvents(active);
      } catch (error) {
        console.error('Failed to load command ops:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isConnected, address]);
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-md w-full"
        >
          <div
            className="rounded-2xl p-10"
            style={{
              background: 'var(--bg-panel)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid var(--border-accent)',
              boxShadow: '0 0 60px var(--hud-glow)',
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: 'var(--accent-primary-dim)', boxShadow: '0 0 24px var(--hud-glow)' }}
            >
              <Swords className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
            </div>
            <h1
              className="font-display text-3xl font-black tracking-widest uppercase mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Command Ops
            </h1>
            <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
              Authenticate your wallet to access the operations center.
            </p>
            <ConnectWallet />
          </div>
        </motion.div>
      </div>
    );
  }
  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <section
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-accent)',
            boxShadow: '0 0 40px var(--hud-glow)',
          }}
        >
          <div
            className="h-0.5"
            style={{ background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-orange), var(--accent-primary))' }}
          />
          <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p
                className="text-[10px] font-tactical font-bold tracking-[0.2em] uppercase mb-0.5"
                style={{ color: 'var(--accent-primary)' }}
              >
                CCWG Operations
              </p>
              <h1
                className="font-display text-2xl md:text-3xl font-black tracking-widest uppercase"
                style={{ color: 'var(--text-primary)' }}
              >
                Command Ops
              </h1>
              <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                {address?.slice(0, 10)}...{address?.slice(-8)}
              </p>
            </div>
            <Link
              href="/lobby"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-display font-black tracking-wide text-sm uppercase transition-all"
              style={{
                background: 'var(--accent-primary)',
                color: 'var(--bg-primary)',
                boxShadow: '0 0 24px var(--accent-primary-glow)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 0 40px var(--accent-primary-glow)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 0 24px var(--accent-primary-glow)')}
            >
              Enter Match Queue
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
        <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard
            label="Stark Points"
            value={loading ? '-' : String(stats?.stark_points ?? 0)}
            customIcon={
              <Image src="/assets/icons/sp-icon.png" alt="SP" width={16} height={16} className="shrink-0" />
            }
          />
          <StatCard
            label="Rank"
            value={loading ? '-' : myRank ? `#${myRank}` : 'Unranked'}
            icon={Crown}
          />
          <StatCard
            label={`Inbox${unreadInbox > 0 ? ` (${unreadInbox})` : ''}`}
            value={loading ? '-' : String(unreadInbox)}
            icon={Bell}
            href="/inbox"
          />
        </section>
        <section className="grid lg:grid-cols-3 gap-4">
          {/* Operations grid */}
          <div
            className="lg:col-span-2 rounded-2xl p-4 md:p-5"
            style={{
              background: 'var(--bg-panel)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-base)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="h-4 w-0.5 rounded-full" style={{ background: 'var(--accent-primary)' }} />
              <h2
                className="font-tactical font-bold text-sm tracking-widest uppercase"
                style={{ color: 'var(--text-primary)' }}
              >
                Operations
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <ActionButton
                href="/lobby?mode=ranked"
                title="Ranked Duel"
                subtitle="Enter the competitive ladder"
                icon={Crown}
                accent="var(--accent-primary)"
              />
              <ActionButton
                href="/lobby"
                title="Training Simulation"
                subtitle="Drill against Bot opponents"
                icon={Swords}
                accent="var(--accent-orange)"
              />
              <ActionButton
                href="/events"
                title="WarZone Events"
                subtitle="Scheduled competitive operations"
                icon={CalendarClock}
                accent="var(--accent-red)"
              />
              <ActionButton
                href="/market"
                title="Armory"
                subtitle="Acquire cards and packs"
                icon={ShoppingBag}
                accent="var(--accent-primary)"
              />
            </div>
          </div>

          {/* Registered Events */}
          <div
            className="rounded-2xl p-4 md:p-5 flex flex-col"
            style={{
              background: 'var(--bg-panel)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-base)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-4 w-0.5 rounded-full" style={{ background: 'var(--accent-orange)' }} />
                <h2
                  className="font-tactical font-bold text-sm tracking-widest uppercase"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Active Deployments
                </h2>
              </div>
              <Link
                href="/events"
                className="text-[10px] font-tactical tracking-widest uppercase transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                All Events
              </Link>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center py-8">
                <div
                  className="w-6 h-6 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'var(--border-base)', borderTopColor: 'var(--accent-orange)' }}
                />
              </div>
            ) : registeredEvents.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center gap-3">
                <CalendarClock className="w-8 h-8 opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  No active deployments. Register for an event to see it here.
                </p>
                <Link
                  href="/events"
                  className="text-xs font-tactical font-semibold"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  Browse Events {'->'}
                </Link>
              </div>
            ) : (
              <div className="space-y-2 flex-1">
                {registeredEvents.map((event) => (
                  <div
                    key={event.event_id}
                    className="rounded-xl p-3"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-accent)',
                      boxShadow: '0 0 12px var(--hud-glow)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <p
                        className="text-sm font-display font-black tracking-wide"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {event.event_name}
                      </p>
                      <span
                        className="text-[10px] font-tactical font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                        style={{
                          background: event.status === 'InProgress' ? 'var(--accent-red)' : 'var(--accent-primary-dim)',
                          color: event.status === 'InProgress' ? '#fff' : 'var(--accent-primary)',
                        }}
                      >
                        {event.status === 'InProgress' ? ' LIVE' : 'OPEN'}
                      </span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(event.starts_at).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                      {'  '}{formatStrk(event.entry_fee)} STRK entry
                    </p>
                    <Link
                      href="/events"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-tactical font-semibold transition-colors"
                      style={{ color: 'var(--accent-primary)' }}
                    >
                      View <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <section
          className="rounded-2xl p-4 md:p-5"
          style={{
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-base)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="h-4 w-0.5 rounded-full" style={{ background: 'var(--accent-primary)' }} />
            <h2
              className="font-tactical font-bold text-sm tracking-widest uppercase"
              style={{ color: 'var(--text-primary)' }}
            >
              Combat Log
            </h2>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl h-16 animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
              ))}
            </div>
          ) : recentMatches.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
              No recorded engagements yet.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentMatches.slice(0, 4).map((match) => {
                const myWallet = address?.toLowerCase() || '';
                const isP1 = match.player_1?.toLowerCase() === myWallet;
                const myScore = isP1 ? match.p1_rounds_won : match.p2_rounds_won;
                const oppScore = isP1 ? match.p2_rounds_won : match.p1_rounds_won;
                const result =
                  !match.winner
                    ? 'Draw'
                    : match.winner.toLowerCase() === myWallet
                    ? 'Win'
                    : 'Loss';
                const resultAccent =
                  result === 'Win'
                    ? 'var(--accent-primary)'
                    : result === 'Loss'
                    ? 'var(--accent-red)'
                    : '#f59e0b';

                return (
                  <div
                    key={match.match_id}
                    className="rounded-xl px-3 py-2.5"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: `1px solid ${resultAccent}30`,
                      boxShadow: `0 0 10px ${resultAccent}15`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p
                        className="text-xs font-tactical font-semibold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        #{match.match_id}  {match.mode}
                      </p>
                      <span
                        className="text-[10px] font-display font-black tracking-widest"
                        style={{ color: resultAccent }}
                      >
                        {result.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {myScore}{oppScore} / {match.total_rounds} rounds
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  customIcon,
  href,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  customIcon?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <div
      className="rounded-xl p-3 h-full"
      style={{
        background: 'var(--bg-panel)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-base)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {customIcon ?? (Icon && (
          <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
        ))}
        <p
          className="text-[10px] font-tactical font-bold tracking-widest uppercase truncate"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </p>
      </div>
      <p
        className="font-display font-black text-lg leading-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  );

  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

function ActionButton({
  href,
  title,
  subtitle,
  icon: Icon,
  accent,
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl p-3 transition-all"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-base)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${accent}60`;
        e.currentTarget.style.boxShadow = `0 0 16px ${accent}20`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-base)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
        <p className="font-display font-black text-sm tracking-wide" style={{ color: 'var(--text-primary)' }}>
          {title}
        </p>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {subtitle}
      </p>
    </Link>
  );
}


