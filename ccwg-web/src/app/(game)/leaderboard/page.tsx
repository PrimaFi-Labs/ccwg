//ccwg-web/src/app/(game)/leaderboard/page.tsx

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAccount } from '@starknet-react/core';
import { Trophy, Crown, Medal, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeaderboardEntry {
  wallet_address: string;
  username: string | null;
  stark_points: number;
  rank: number;
}

const PODIUM_META = [
  { rankLabel: '#1', color: '#f59e0b', glow: 'rgba(245,158,11,0.35)', icon: Crown, labelSize: 'text-3xl', podiumH: 'h-28' },
  { rankLabel: '#2', color: '#94a3b8', glow: 'rgba(148,163,184,0.25)', icon: Medal, labelSize: 'text-2xl', podiumH: 'h-20' },
  { rankLabel: '#3', color: '#ea580c', glow: 'rgba(234,88,12,0.25)',   icon: Medal, labelSize: 'text-2xl', podiumH: 'h-16' },
] as const;

const RANK_COLORS: Record<number, string> = { 1: '#f59e0b', 2: '#94a3b8', 3: '#ea580c' };

export default function LeaderboardPage() {
  const { address } = useAccount();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [myRank, setMyRank] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { fetchLeaderboard(searchQuery); }, 220);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, address]);

  const fetchLeaderboard = async (query = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: query ? '50' : '100' });
      if (query) params.set('q', query);
      if (address) params.set('wallet_address', address);
      const response = await fetch(`/api/leaderboard?${params.toString()}`);
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
      setMyRank(typeof data.my_rank === 'number' ? data.my_rank : null);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-3">
            <Trophy className="w-8 h-8" style={{ color: '#f59e0b', filter: 'drop-shadow(0 0 10px #f59e0b80)' }} />
            <h1 className="font-display text-3xl md:text-4xl font-black tracking-widest uppercase text-[var(--text-primary)]">
              Leaderboard
            </h1>
            <Trophy className="w-8 h-8" style={{ color: '#f59e0b', filter: 'drop-shadow(0 0 10px #f59e0b80)' }} />
          </div>
          <p className="text-xs font-tactical tracking-widest uppercase text-[var(--text-muted)]">
            Ranked by Stark Points
          </p>
        </div>

        {/* ── My rank + search ── */}
        <div className="grid sm:grid-cols-2 gap-3">
          {/* My rank badge */}
          <div
            className="rounded-xl border flex items-center justify-between px-5 py-4"
            style={{
              background: 'var(--bg-panel)',
              backdropFilter: 'blur(12px)',
              borderColor: address ? 'var(--border-accent)' : 'var(--border-base)',
              boxShadow: address ? '0 0 20px var(--hud-glow)' : 'none',
            }}
          >
            <div>
              <p className="text-[10px] font-tactical font-bold tracking-widest uppercase text-[var(--text-muted)] mb-0.5">My Rank</p>
              <p className="font-mono text-xs text-[var(--text-muted)] truncate max-w-[120px]">
                {address ? `${address.slice(0, 8)}…` : 'Not connected'}
              </p>
            </div>
            <p
              className="font-display text-3xl font-black"
              style={{ color: myRank ? 'var(--accent-primary)' : 'var(--text-muted)' }}
            >
              {address ? (myRank ? `#${myRank}` : '—') : '--'}
            </p>
          </div>

          {/* Search */}
          <div
            className="rounded-xl border flex items-center gap-3 px-4"
            style={{
              background: 'var(--bg-panel)',
              backdropFilter: 'blur(12px)',
              borderColor: searchQuery ? 'var(--border-accent)' : 'var(--border-base)',
            }}
          >
            <Search className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player…"
              className="flex-1 bg-transparent py-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>
        </div>

        {/* ── Top 3 podium ── */}
        {!loading && top3.length >= 3 && !searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end justify-center gap-3 pt-4"
          >
            {/* Reorder: 2nd, 1st, 3rd */}
            {[1, 0, 2].map((podiumIdx) => {
              const entry = top3[podiumIdx];
              if (!entry) return null;
              const meta = PODIUM_META[podiumIdx];
              const Icon = meta.icon;
              const isMe = Boolean(address && entry.wallet_address.toLowerCase() === address.toLowerCase());
              const displayOrder = podiumIdx === 0 ? 'order-2' : podiumIdx === 1 ? 'order-1' : 'order-3';

              return (
                <motion.div
                  key={entry.wallet_address}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: podiumIdx * 0.1 }}
                  className={`flex flex-col items-center gap-2 ${displayOrder} ${podiumIdx === 0 ? 'flex-1 max-w-[160px]' : 'flex-1 max-w-[130px]'}`}
                >
                  {/* Name card */}
                  <div
                    className="w-full rounded-xl border px-3 py-3 text-center"
                    style={{
                      background: isMe ? `${meta.color}12` : 'var(--bg-panel)',
                      backdropFilter: 'blur(16px)',
                      borderColor: meta.color + (isMe ? 'cc' : '55'),
                      boxShadow: `0 0 25px ${meta.glow}`,
                    }}
                  >
                    <Icon className="w-5 h-5 mx-auto mb-1.5" style={{ color: meta.color }} />
                    <p
                      className="font-display font-black truncate w-full text-sm"
                      style={{ color: isMe ? meta.color : 'var(--text-primary)' }}
                    >
                      {entry.username || 'Anon'}
                    </p>
                    <p className="font-display font-bold text-xs mt-0.5 flex items-center justify-center gap-1" style={{ color: meta.color }}>
                      <Image src="/assets/icons/sp-icon.png" alt="SP" width={10} height={10} className="shrink-0 opacity-80" />
                      {entry.stark_points.toLocaleString()}
                    </p>
                  </div>
                  {/* Podium bar */}
                  <div
                    className={`w-full ${meta.podiumH} rounded-t-lg`}
                    style={{
                      background: `linear-gradient(to top, ${meta.color}40, ${meta.color}10)`,
                      border: `1px solid ${meta.color}40`,
                      borderBottom: 'none',
                    }}
                  />
                  {/* Rank label */}
                  <div
                    className={`font-display font-black ${meta.labelSize}`}
                    style={{ color: meta.color, textShadow: `0 0 20px ${meta.glow}` }}
                  >
                    {meta.rankLabel}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* ── Full ranked list ── */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: 'var(--bg-panel)', backdropFilter: 'blur(16px)', borderColor: 'var(--border-base)' }}
        >
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="p-16 text-center text-[var(--text-muted)] text-sm">
              {searchQuery ? `No results for "${searchQuery}"` : 'No players yet.'}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {(searchQuery ? leaderboard : rest).map((entry, i) => {
                const isMe = Boolean(address && entry.wallet_address.toLowerCase() === address.toLowerCase());
                const rank = entry.rank;
                const rankColor = RANK_COLORS[rank] ?? (isMe ? 'var(--accent-primary)' : 'var(--text-muted)');

                return (
                  <motion.div
                    key={entry.wallet_address}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ delay: i * 0.025 }}
                    className="flex items-center gap-4 px-5 py-3 transition-all"
                    style={{
                      borderBottom: '1px solid var(--border-base)',
                      background: isMe ? 'var(--accent-primary-dim)' : 'transparent',
                      boxShadow: isMe ? '0 0 20px var(--hud-glow)' : 'none',
                    }}
                    onMouseEnter={(e) => { if (!isMe) (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={(e) => { if (!isMe) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* Rank */}
                    <div className="w-8 shrink-0 text-center">
                      <span className="font-display font-black text-sm" style={{ color: rankColor }}>
                        #{rank}
                      </span>
                    </div>

                    {/* Player info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-tactical font-semibold text-sm truncate"
                        style={{ color: isMe ? 'var(--accent-primary)' : 'var(--text-primary)' }}
                      >
                        {entry.username || 'Anonymous'}
                        {isMe && <span className="ml-2 text-[10px] font-display font-bold tracking-wider uppercase opacity-60">You</span>}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] font-mono">
                        {entry.wallet_address.slice(0, 8)}…{entry.wallet_address.slice(-6)}
                      </p>
                    </div>

                    {/* Points */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Image src="/assets/icons/sp-icon.png" alt="SP" width={14} height={14} className="shrink-0" />
                      <span className="font-display font-bold text-sm text-[var(--text-primary)]">
                        {entry.stark_points.toLocaleString()}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

      </div>
    </div>
  );
}
