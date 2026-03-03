//ccwg-web/src/app/match/[matchId]/results/page.tsx

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Crown, Sword, Swords, Shield, Zap, TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type RoundLog = {
  round: number;
  myAction: string | null;
  opponentAction: string | null;
  myMomentum: number;
  opponentMomentum: number;
  myDamageDealt: number;
  myDamageReceived: number;
  winner: string | null;
  outcome: 'win' | 'loss' | 'draw';
};

const actionIcon = (action: string | null) => {
  switch (action) {
    case 'Attack': return <Sword className="w-3.5 h-3.5" />;
    case 'Defend': return <Shield className="w-3.5 h-3.5" />;
    case 'Charge': return <Zap className="w-3.5 h-3.5" />;
    default: return <Shield className="w-3.5 h-3.5" />;
  }
};

export default function MatchResultsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = params.matchId as string;
  const tournamentEventId = searchParams.get('eventId');
  const [tournamentName, setTournamentName] = useState<string | null>(null);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [logs] = useState<RoundLog[]>(() => {
    try {
      const stored = sessionStorage.getItem(`ccwg:match:${matchId}:roundLogs`);
      if (stored) {
        const parsed = JSON.parse(stored) as RoundLog[];
        const byRound = new Map<number, RoundLog>();
        for (const log of parsed) {
          byRound.set(log.round, log);
        }
        return Array.from(byRound.values()).sort((a, b) => a.round - b.round);
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    if (!tournamentEventId) return;

    const loadTournament = async () => {
      try {
        const eventIdNum = Number.parseInt(tournamentEventId, 10);
        if (!Number.isFinite(eventIdNum)) return;
        const res = await fetch(`/api/events/${eventIdNum}`, { cache: 'no-store' });
        const data = await res.json();
        const name = data?.event?.event_name;
        if (typeof name === 'string' && name.trim().length > 0) {
          setTournamentName(name);
        }
      } catch {
        setTournamentName(null);
      }
    };

    void loadTournament();
  }, [tournamentEventId]);

  const summary = useMemo(() => {
    let myDamageDealt = 0;
    let myDamageReceived = 0;
    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (const log of logs) {
      myDamageDealt += log.myDamageDealt;
      myDamageReceived += log.myDamageReceived;
      if (log.outcome === 'win') wins += 1;
      else if (log.outcome === 'loss') losses += 1;
      else draws += 1;
    }

    return { myDamageDealt, myDamageReceived, wins, losses, draws };
  }, [logs]);

  const matchOutcome = useMemo(() => {
    if (summary.wins > summary.losses) return 'WIN';
    if (summary.losses > summary.wins) return 'LOSS';
    return 'DRAW';
  }, [summary.wins, summary.losses]);

  const outcomeColor = matchOutcome === 'WIN' ? '#22c55e' : matchOutcome === 'LOSS' ? '#ef4444' : '#eab308';
  const outcomeBg = matchOutcome === 'WIN'
    ? 'rgba(34,197,94,0.08)'
    : matchOutcome === 'LOSS'
      ? 'rgba(239,68,68,0.08)'
      : 'rgba(234,179,8,0.08)';

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--bg-primary)' }}>
      {/* Ambient glow behind the card */}
      <motion.div
        className="fixed inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ duration: 1.5 }}
        style={{
          background: `radial-gradient(ellipse 50% 40% at 50% 30%, ${outcomeColor}22, transparent)`,
        }}
      />

      <div className="relative max-w-2xl mx-auto flex flex-col gap-5">
        {/* === HERO RESULT CARD === */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl overflow-hidden border"
          style={{
            background: 'var(--bg-panel)',
            borderColor: `${outcomeColor}44`,
            boxShadow: `0 0 60px ${outcomeColor}15, 0 4px 24px rgba(0,0,0,0.4)`,
          }}
        >
          {/* Top accent bar */}
          <div className="h-1" style={{ background: `linear-gradient(90deg, transparent, ${outcomeColor}, transparent)` }} />

          <div className="flex flex-col items-center py-8 px-6 text-center">
            {/* Outcome icon */}
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 14 }}
              className="mb-4 p-4 rounded-full"
              style={{ background: outcomeBg, border: `2px solid ${outcomeColor}44` }}
            >
              {matchOutcome === 'WIN' && <Crown className="w-10 h-10" style={{ color: outcomeColor }} />}
              {matchOutcome === 'LOSS' && <Sword className="w-10 h-10 rotate-45" style={{ color: outcomeColor }} />}
              {matchOutcome === 'DRAW' && <Swords className="w-10 h-10" style={{ color: outcomeColor }} />}
            </motion.div>

            {/* Outcome text */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-3xl sm:text-4xl font-black tracking-wider"
              style={{ color: outcomeColor }}
            >
              {matchOutcome === 'WIN' ? 'VICTORY' : matchOutcome === 'LOSS' ? 'DEFEAT' : 'DEADLOCK'}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="text-sm mt-2 max-w-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              {matchOutcome === 'WIN'
                ? 'Your blade was sharper. The arena bows to you.'
                : matchOutcome === 'LOSS'
                  ? 'Fallen — but not forgotten. Return stronger.'
                  : 'A clash of equals. The arena demands a rematch.'}
            </motion.p>
          </div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="grid grid-cols-3 border-t"
            style={{ borderColor: 'var(--border-base)' }}
          >
            {[
              { label: 'Damage Dealt', value: summary.myDamageDealt, icon: <TrendingUp className="w-4 h-4 text-emerald-400" /> },
              { label: 'Damage Taken', value: summary.myDamageReceived, icon: <TrendingDown className="w-4 h-4 text-red-400" /> },
              { label: 'Rounds', value: `${summary.wins}W ${summary.losses}L ${summary.draws}D`, icon: <Swords className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="flex flex-col items-center py-5 px-2 gap-1"
                style={{ borderRight: i < 2 ? '1px solid var(--border-base)' : 'none' }}
              >
                {stat.icon}
                <span className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {stat.value}
                </span>
                <span className="text-[10px] sm:text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* === BATTLE CHRONICLE === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="rounded-2xl overflow-hidden border"
          style={{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-base)',
          }}
        >
          <div className="px-5 py-4 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border-base)' }}>
            <Swords className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Battle Chronicle
            </h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
              {logs.length} rounds
            </span>
          </div>

          {/* Desktop table (hidden on mobile) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['Round', 'Your Action', 'Enemy Action', 'Dmg Dealt', 'Dmg Taken', 'Result'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      No battle data recorded.
                    </td>
                  </tr>
                )}
                {logs.map((log, i) => (
                  <motion.tr
                    key={log.round}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.1 + i * 0.06 }}
                    className="transition-colors"
                    style={{
                      borderBottom: '1px solid var(--border-base)',
                      color: 'var(--text-primary)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td className="px-4 py-3 font-mono font-semibold" style={{ color: 'var(--accent-primary)' }}>
                      {String(log.round).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {actionIcon(log.myAction)}
                        {log.myAction ?? 'Defend'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {actionIcon(log.opponentAction)}
                        {log.opponentAction ?? 'Defend'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">+{log.myDamageDealt}</td>
                    <td className="px-4 py-3 font-semibold text-red-400">-{log.myDamageReceived}</td>
                    <td className="px-4 py-3">
                      {log.outcome === 'win' && <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold"><Crown className="w-3.5 h-3.5" /> Won</span>}
                      {log.outcome === 'loss' && <span className="inline-flex items-center gap-1 text-red-400 font-semibold"><Sword className="w-3.5 h-3.5 rotate-45" /> Lost</span>}
                      {log.outcome === 'draw' && <span className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--text-muted)' }}><Minus className="w-3.5 h-3.5" /> Draw</span>}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile accordion (hidden on desktop) */}
          <div className="sm:hidden divide-y" style={{ borderColor: 'var(--border-base)' }}>
            {logs.length === 0 && (
              <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No battle data recorded.
              </p>
            )}
            {logs.map((log, i) => (
              <motion.div
                key={log.round}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 + i * 0.06 }}
                style={{ borderColor: 'var(--border-base)' }}
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setExpandedRound(expandedRound === log.round ? null : log.round)}
                >
                  <span className="font-mono text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>
                    R{log.round}
                  </span>
                  <span className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                    {actionIcon(log.myAction)} {log.myAction ?? 'Defend'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>vs</span>
                  <span className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                    {actionIcon(log.opponentAction)} {log.opponentAction ?? 'Defend'}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {log.outcome === 'win' && <Crown className="w-4 h-4 text-emerald-400" />}
                    {log.outcome === 'loss' && <Sword className="w-4 h-4 text-red-400 rotate-45" />}
                    {log.outcome === 'draw' && <Minus className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                    <ChevronDown
                      className="w-4 h-4 transition-transform"
                      style={{
                        color: 'var(--text-muted)',
                        transform: expandedRound === log.round ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  </span>
                </button>
                <AnimatePresence>
                  {expandedRound === log.round && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-3 px-4 pb-4 text-sm">
                        <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
                          <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                            Dmg Dealt
                          </span>
                          <span className="text-lg font-bold text-emerald-400">+{log.myDamageDealt}</span>
                        </div>
                        <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
                          <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                            Dmg Taken
                          </span>
                          <span className="text-lg font-bold text-red-400">-{log.myDamageReceived}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* === RETURN BUTTON === */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.4 }}
          className="flex justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() =>
              tournamentEventId
                ? router.push(`/events/${tournamentEventId}`)
                : router.push('/lobby')
            }
            className="px-8 py-3 rounded-xl font-semibold text-sm tracking-wide transition-colors"
            style={{
              background: 'var(--accent-primary)',
              color: '#fff',
              boxShadow: `0 0 20px var(--accent-primary-glow)`,
            }}
          >
            {tournamentEventId
              ? `Return to ${tournamentName ?? 'Tournament'}`
              : 'Return to Lobby'}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
