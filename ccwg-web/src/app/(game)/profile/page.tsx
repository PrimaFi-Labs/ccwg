'use client';

import { useState, useEffect } from 'react';
import type { ComponentType, ReactNode } from 'react';
import Image from 'next/image';
import { useAccount } from '@starknet-react/core';
import { ConnectWallet } from '@/src/components/auth/ConnectWallet';
import { SocialPanel } from '@/src/components/profile/SocialPanel';
import { Trophy, Target, TrendingUp, Copy, Wallet, Droplets, ExternalLink, Shield, Swords, Star, Package, CalendarDays } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatStrk } from '@/src/lib/cartridge/utils';

interface PlayerStats {
  total_matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  stark_points: number;
  cards_owned: number;
  total_events_joined: number;
  strk_balance: string;
}

interface RecentMatch {
  match_id: number;
  mode: 'VsAI' | 'Ranked1v1' | 'WarZone' | 'Room' | 'Challenge';
  status: 'WaitingForOpponent' | 'InProgress' | 'PausedOracle' | 'Completed' | 'Cancelled';
  player_1: string;
  player_2: string;
  winner: string | null;
  created_at: string;
  ended_at: string | null;
  p1_rounds_won: number;
  p2_rounds_won: number;
  total_rounds: number;
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [onchainBalance, setOnchainBalance] = useState<string>('0');
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    const fetchProfileData = async () => {
      try {
        const [statsRes, matchesRes, profileRes] = await Promise.all([
          fetch(`/api/player/stats?wallet_address=${address}`),
          fetch(`/api/player/matches?wallet_address=${address}&limit=8`),
          fetch(`/api/player/profile?wallet_address=${address}`),
        ]);
        const [statsData, matchesData, profileData] = await Promise.all([
          statsRes.json(),
          matchesRes.json(),
          profileRes.json(),
        ]);
        setStats(statsData.stats);
        setRecentMatches(matchesData.matches || []);
        if (profileData.player) {
          setUsername(profileData.player.username || null);
          setJoinedAt(profileData.player.created_at || null);
        }
      } catch (error) {
        console.error('Failed to fetch profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [address]);

  useEffect(() => {
    if (!address) return;
    const fetchBalance = async () => {
      try {
        setBalanceLoading(true);
        setBalanceError(null);
        const res = await fetch(`/api/wallet/balance?wallet_address=${address}`);
        const data = await res.json();
        if (!res.ok) { setBalanceError(data?.error || 'Failed to fetch balance'); return; }
        if (data?.balance) setOnchainBalance(data.balance);
      } catch {
        setBalanceError('Failed to fetch balance');
      } finally {
        setBalanceLoading(false);
      }
    };
    fetchBalance();
  }, [address]);

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const monogram = username
    ? username.slice(0, 2).toUpperCase()
    : address
      ? address.slice(2, 4).toUpperCase()
      : '??';

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative text-center p-12 rounded-2xl border overflow-hidden max-w-sm w-full"
          style={{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-accent)',
            boxShadow: '0 0 60px var(--hud-glow)',
          }}
        >
          {/* scan-line sweep */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, var(--accent-primary) 2px, var(--accent-primary) 3px)',
              animation: 'pulse 4s ease-in-out infinite',
            }}
          />

          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent-primary-dim)', boxShadow: '0 0 30px var(--accent-primary-glow)' }}
          >
            <Target className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
          </motion.div>

          <h2 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Profile Locked</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
            Connect your wallet to access your combat stats
          </p>
          <ConnectWallet />
        </motion.div>
      </div>
    );
  }

  const STAT_CARDS: { icon: ComponentType<{ className?: string; style?: object }>; customIcon?: ReactNode; label: string; value: string | number; accent: string }[] = [
    { icon: Trophy, customIcon: <Image src="/assets/icons/sp-icon.png" alt="SP" width={16} height={16} className="shrink-0" />, label: 'Stark Points', value: stats?.stark_points ?? '—', accent: '#f59e0b' },
    { icon: Swords,    label: 'Wins',            value: stats?.wins           ?? '—', accent: 'var(--accent-primary)' },
    { icon: Shield,    label: 'Losses',          value: stats?.losses         ?? '—', accent: '#f87171' },
    { icon: Target,    label: 'Win Rate',        value: stats ? `${stats.win_rate.toFixed(1)}%` : '—', accent: '#a855f7' },
    { icon: TrendingUp,label: 'Matches',         value: stats?.total_matches  ?? '—', accent: 'var(--accent-primary)' },
    { icon: Package,   label: 'Cards Owned',     value: stats?.cards_owned    ?? '—', accent: '#f59e0b' },
    { icon: Star,      label: 'Events Joined',   value: stats?.total_events_joined ?? '—', accent: '#f87171' },
    { icon: Wallet,    label: 'On-chain STRK',   value: balanceLoading ? '…' : balanceError ? 'Error' : `${formatStrk(onchainBalance)}`, accent: '#a855f7' },
  ];

  const winPct = stats && stats.total_matches > 0 ? (stats.wins / stats.total_matches) * 100 : 0;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Hero card ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border overflow-hidden"
          style={{
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderColor: 'var(--border-accent)',
            boxShadow: '0 0 50px var(--hud-glow)',
          }}
        >
          {/* Accent top bar */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-orange), var(--accent-red))' }} />

          <div className="p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar monogram */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center font-display text-3xl font-black shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--accent-primary-dim), var(--accent-primary))',
                boxShadow: '0 0 30px var(--accent-primary-glow)',
                color: 'var(--bg-primary)',
              }}
            >
              {monogram}
            </div>

            <div className="flex-1 min-w-0">
              {/* Username */}
              <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-black tracking-widest uppercase text-[var(--text-primary)] truncate max-w-full break-all leading-tight">
                {loading ? '…' : username ?? 'Unnamed'}
              </h1>

              {/* Wallet row */}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="font-mono text-xs text-[var(--text-muted)] truncate max-w-[240px]">
                  {address?.slice(0, 10)}…{address?.slice(-8)}
                </span>
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-tactical font-bold tracking-wider uppercase transition-colors"
                  style={{
                    background: copied ? 'var(--accent-primary-dim)' : 'var(--bg-tertiary)',
                    color: copied ? 'var(--accent-primary)' : 'var(--text-muted)',
                    border: '1px solid var(--border-base)',
                  }}
                >
                  <Copy className="w-3 h-3" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {joinedAt && (
                <div className="flex items-center gap-1.5 mt-2">
                  <CalendarDays className="w-3 h-3 text-[var(--text-muted)]" />
                  <span className="text-[11px] text-[var(--text-muted)] font-tactical tracking-wider">
                    Joined {new Date(joinedAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>

            {/* SP badge */}
            {stats && (
              <div
                className="shrink-0 text-center px-5 py-3 rounded-xl border"
                style={{
                  background: 'rgba(245,158,11,0.08)',
                  borderColor: 'rgba(245,158,11,0.35)',
                  boxShadow: '0 0 20px rgba(245,158,11,0.15)',
                }}
              >
                <p className="font-display text-3xl font-black" style={{ color: '#f59e0b' }}>
                  {stats.stark_points.toLocaleString()}
                </p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <Image src="/assets/icons/sp-icon.png" alt="SP" width={10} height={10} className="shrink-0 opacity-70" />
                  <p className="text-[10px] font-tactical font-bold tracking-widest uppercase" style={{ color: '#f59e0b99' }}>Stark Points</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Win/Loss visualization ── */}
        {stats && stats.total_matches > 0 && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0.9 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-xl border p-4"
            style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-base)', backdropFilter: 'blur(12px)' }}
          >
            <div className="flex items-center justify-between text-xs font-tactical font-bold tracking-widest uppercase mb-3">
              <span style={{ color: 'var(--accent-primary)' }}>{stats.wins} Wins</span>
              <span className="text-[var(--text-muted)]">{stats.total_matches} Played</span>
              <span style={{ color: '#f87171' }}>{stats.losses} Losses</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${winPct}%` }}
                transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, var(--accent-primary), #f59e0b)' }}
              />
            </div>
          </motion.div>
        )}

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STAT_CARDS.map(({ icon: Icon, customIcon, label, value, accent }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.05 }}
              className="rounded-xl border p-4"
              style={{
                background: 'var(--bg-panel)',
                backdropFilter: 'blur(12px)',
                borderColor: `${accent}30`,
                boxShadow: `0 0 15px ${accent}10`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {customIcon ?? <Icon className="w-4 h-4" style={{ color: accent }} />}
                <span className="text-[10px] font-tactical font-bold tracking-wider uppercase text-[var(--text-muted)]">{label}</span>
              </div>
              <p className="font-display text-2xl font-black text-[var(--text-primary)]">{loading ? '…' : value}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Match history ── */}
        {address && <SocialPanel walletAddress={address} />}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl border overflow-hidden"
          style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-base)', backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--border-base)' }}>
            <TrendingUp className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <h2 className="font-display text-lg font-black tracking-widest uppercase text-[var(--text-primary)]">
              Match History
            </h2>
          </div>

          {loading ? (
            <div className="p-8 space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
              ))}
            </div>
          ) : recentMatches.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-muted)] text-sm">No recent matches found.</div>
          ) : (
            <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
              {recentMatches.map((m, i) => {
                const walletLower = address?.toLowerCase() || '';
                const isP1 = m.player_1?.toLowerCase() === walletLower;
                const myScore = isP1 ? m.p1_rounds_won : m.p2_rounds_won;
                const oppScore = isP1 ? m.p2_rounds_won : m.p1_rounds_won;
                const opponent =
                  m.mode === 'VsAI'
                    ? 'Bot'
                    : ((isP1 ? m.player_2 : m.player_1)?.slice(0, 6) || '???') + '…';
                const result =
                  !m.winner
                    ? 'Draw'
                    : m.winner.toLowerCase() === walletLower ? 'Win' : 'Loss';
                const rc = result === 'Win' ? '#4ade80' : result === 'Loss' ? '#f87171' : '#fbbf24';

                return (
                  <motion.div
                    key={m.match_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                    style={{ borderColor: 'var(--border-base)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-tactical font-semibold text-[var(--text-primary)] truncate">
                        {m.mode} <span className="text-[var(--text-muted)] font-normal">vs</span> {opponent}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        #{m.match_id} · {new Date(m.ended_at || m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-display font-bold" style={{ color: rc }}>{result}</p>
                      <p className="text-xs text-[var(--text-muted)]">{myScore}–{oppScore} / {m.total_rounds}R</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Faucet card ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl border p-6"
          style={{
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(12px)',
            borderColor: 'rgba(34,211,238,0.3)',
            boxShadow: '0 0 20px rgba(34,211,238,0.08)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Droplets className="w-5 h-5" style={{ color: 'rgb(34,211,238)' }} />
            <h2 className="font-display text-lg font-black tracking-widest uppercase" style={{ color: 'rgb(34,211,238)' }}>
              Sepolia Faucet
            </h2>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Need test STRK for market purchases, events, and room stakes?
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://starknet-faucet.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-tactical font-semibold transition-opacity hover:opacity-80"
              style={{
                background: 'rgba(34,211,238,0.12)',
                border: '1px solid rgba(34,211,238,0.3)',
                color: 'rgb(34,211,238)',
              }}
            >
              Open Faucet <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={copyAddress}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-tactical font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-base)', color: 'var(--text-secondary)' }}
            >
              Copy Wallet <Copy className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
