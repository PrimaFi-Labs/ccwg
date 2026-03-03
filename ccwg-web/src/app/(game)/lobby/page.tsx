//ccwg-web/src/app/(game)/lobby/page.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '@starknet-react/core';
import { CallData, cairo } from 'starknet';
import { ConnectWallet } from '@/src/components/auth/ConnectWallet';
import { CardSelector } from '@/src/components/cards/CardSelector';
import {
  Bot, Users, Swords, Trophy, X, Copy, Check,
  ChevronRight, Crown, Shield, LogIn, Loader2, AlertTriangle
} from 'lucide-react';
import type { PlayerCard, BotProfile } from '@/src/types/database';
import { useRouter, useSearchParams } from 'next/navigation';
import { strkToWei } from '@/src/lib/cartridge/utils';
import { buildMatchPath } from '@/src/lib/matches/url';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { ESCROW_SYSTEM_ADDRESS, STRK_TOKEN_ADDRESS } from '@/src/types/contracts';

type RoomSummary = {
  room_id: number;
  room_code: string;
  stake_fee: string;
  current_players: number;
  max_players: number;
  matches_per_player: number;
};

const MODES = [
  {
    key: 'ai' as const,
    icon: Bot,
    label: 'VS BOT',
    badge: 'Free',
    description: 'Sharpen your strategy against intelligent Bot opponents.',
    features: ['Choose difficulty', 'Configurable rounds', 'Practice freely'],
    accent: '#38bdf8',
    glow: 'rgba(56,189,248,0.18)',
    border: 'rgba(56,189,248,0.35)',
  },
  {
    key: 'ranked' as const,
    icon: Users,
    label: 'Ranked 1v1',
    badge: 'Competitive',
    description: 'Auto-match against real opponents. Climb the leaderboard.',
    features: ['Auto-matched', 'Earn Stark Points', 'Rank progression'],
    accent: 'var(--accent-primary)',
    glow: 'var(--accent-primary-glow)',
    border: 'var(--border-accent)',
  },
  {
    key: 'warzone' as const,
    icon: Trophy,
    label: 'WarZone',
    badge: 'Events',
    description: 'Enter live battle events for prestige rewards and prizes.',
    features: ['Entry fee applies', 'Scheduled events', 'Prize + Stark Points'],
    accent: '#f59e0b',
    glow: 'rgba(245,158,11,0.18)',
    border: 'rgba(245,158,11,0.35)',
  },
  {
    key: 'room' as const,
    icon: Crown,
    label: 'Room Match',
    badge: 'Stake',
    description: 'Create or join a staked room. Winner takes the pool.',
    features: ['Set entry fee', 'Public or private', 'Cross-queue matches'],
    accent: '#34d399',
    glow: 'rgba(52,211,153,0.18)',
    border: 'rgba(52,211,153,0.35)',
  },
];

const inputClass =
  'w-full px-3 py-2 rounded-lg text-[var(--text-primary)] text-sm bg-[var(--bg-tertiary)] border border-[var(--border-base)] focus:outline-none focus:border-[var(--accent-primary)] transition placeholder-[var(--text-muted)]';

const labelClass = 'block text-xs font-tactical font-bold tracking-wider uppercase text-[var(--text-muted)] mb-1.5';

const Overlay = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {children}
  </motion.div>
);

const Modal = ({
  children,
  accent = 'var(--border-accent)',
  maxW = 'max-w-lg',
}: {
  children: React.ReactNode;
  accent?: string;
  maxW?: string;
}) => (
  <motion.div
    className={`relative w-full ${maxW} rounded-2xl overflow-hidden flex flex-col`}
    style={{
      background: 'var(--bg-panel)',
      border: `1px solid ${accent}`,
      backdropFilter: 'blur(20px)',
      boxShadow: `0 0 60px ${accent}44`,
      maxHeight: '90vh',
    }}
    initial={{ opacity: 0, scale: 0.95, y: 16 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95, y: 16 }}
    transition={{ type: 'spring', damping: 22, stiffness: 280 }}
  >
    {children}
  </motion.div>
);

const ModalHeader = ({
  title,
  subtitle,
  onClose,
  accent,
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  accent?: string;
}) => (
  <div
    className="shrink-0 px-6 py-5 border-b flex items-start justify-between gap-4"
    style={{ borderColor: 'var(--border-base)', background: 'var(--bg-secondary)' }}
  >
    <div>
      {accent && (
        <div
          className="inline-block text-[9px] font-tactical font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded mb-1.5"
          style={{ color: accent, background: `${accent}18`, border: `1px solid ${accent}40` }}
        >
          Setup
        </div>
      )}
      <h2 className="font-display text-xl font-black text-[var(--text-primary)]">{title}</h2>
      {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
    </div>
    {onClose && (
      <button
        onClick={onClose}
        aria-label="Close"
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
      >
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

const ModalFooter = ({ children }: { children: React.ReactNode }) => (
  <div
    className="shrink-0 px-6 py-4 border-t flex gap-3"
    style={{ borderColor: 'var(--border-base)', background: 'var(--bg-secondary)' }}
  >
    {children}
  </div>
);

const BtnPrimary = ({
  onClick,
  children,
  accent = 'var(--accent-primary)',
  className = '',
  disabled = false,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  accent?: string;
  className?: string;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex-1 px-5 py-2.5 rounded-lg font-tactical font-semibold text-sm tracking-wide transition ${className}`}
    style={{
      background: accent,
      color: '#fff',
      opacity: disabled ? 0.5 : 1,
    }}
  >
    {children}
  </button>
);

const BtnGhost = ({
  onClick,
  children,
  className = '',
}: {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 px-5 py-2.5 rounded-lg font-tactical font-semibold text-sm tracking-wide transition text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-base)] ${className}`}
  >
    {children}
  </button>
);

type NoticeTone = 'success' | 'error' | 'info';

type NoticeItem = {
  id: number;
  tone: NoticeTone;
  title: string;
  message: string;
};

const noticePalette: Record<NoticeTone, { color: string; glow: string; border: string }> = {
  success: {
    color: '#34d399',
    glow: 'rgba(52,211,153,0.2)',
    border: 'rgba(52,211,153,0.35)',
  },
  error: {
    color: '#f87171',
    glow: 'rgba(248,113,113,0.2)',
    border: 'rgba(248,113,113,0.35)',
  },
  info: {
    color: '#60a5fa',
    glow: 'rgba(96,165,250,0.2)',
    border: 'rgba(96,165,250,0.35)',
  },
};

const NoticeFeed = ({
  notices,
  onDismiss,
}: {
  notices: NoticeItem[];
  onDismiss: (id: number) => void;
}) => (
  <div className="pointer-events-none fixed top-5 left-4 right-4 z-[140] flex flex-col gap-3 sm:left-auto sm:right-5 sm:w-[22rem]">
    <AnimatePresence>
      {notices.map((notice) => {
        const palette = noticePalette[notice.tone];
        return (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="pointer-events-auto overflow-hidden rounded-2xl border shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${palette.glow} 0%, rgba(15,23,42,0.96) 55%, rgba(2,6,23,0.98) 100%)`,
              borderColor: palette.border,
              boxShadow: `0 18px 60px ${palette.glow}`,
            }}
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <div
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                style={{
                  background: `${palette.color}18`,
                  borderColor: `${palette.color}44`,
                  color: palette.color,
                }}
              >
                {notice.tone === 'success' ? (
                  <Check className="h-4 w-4" />
                ) : notice.tone === 'error' ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[10px] font-tactical font-bold uppercase tracking-[0.18em]"
                  style={{ color: palette.color }}
                >
                  {notice.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-primary)]">
                  {notice.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(notice.id)}
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-white/5 hover:text-[var(--text-primary)]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div
              className="h-1"
              style={{
                background: `linear-gradient(90deg, ${palette.color} 0%, ${palette.color}55 50%, transparent 100%)`,
              }}
            />
          </motion.div>
        );
      })}
    </AnimatePresence>
  </div>
);

export default function LobbyPage() {
  const { address, account, isConnected } = useAccount();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const noticeCounter = useRef(0);
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [showDeckSelector, setShowDeckSelector] = useState(false);
  const [showBotSelector, setShowBotSelector] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'ranked' | 'ai' | 'warzone' | 'room' | null>(null);
  const [selectedBot, setSelectedBot] = useState<BotProfile | null>(null);
  const [bots, setBots] = useState<BotProfile[]>([]);
  const [aiTotalRounds, setAiTotalRounds] = useState(5);
  const [showRankedSetup, setShowRankedSetup] = useState(false);
  const [rankedTotalRounds, setRankedTotalRounds] = useState<3 | 5 | 10>(5);
  const [matchmakingStatus, setMatchmakingStatus] = useState<'idle' | 'searching' | 'timeout'>('idle');
  const [searchSecondsLeft, setSearchSecondsLeft] = useState(45);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomTab, setRoomTab] = useState<'create' | 'join' | 'myrooms'>('create');
  const [roomVisibility, setRoomVisibility] = useState<'Public' | 'Private'>('Public');
  const [roomStakeFee, setRoomStakeFee] = useState('1');
  const [roomMaxPlayers, setRoomMaxPlayers] = useState(4);
  const [roomMatchesPerPlayer, setRoomMatchesPerPlayer] = useState(10);
  const [roomTotalRounds, setRoomTotalRounds] = useState<3 | 5 | 10>(5);
  const [roomTimerHours, setRoomTimerHours] = useState(6);
  const [roomCode, setRoomCode] = useState('');
  const [publicRooms, setPublicRooms] = useState<RoomSummary[]>([]);
  const [myRooms, setMyRooms] = useState<RoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [joiningPublicRoomId, setJoiningPublicRoomId] = useState<number | null>(null);
  const [handledModeQuery, setHandledModeQuery] = useState(false);
  const [eventContextId, setEventContextId] = useState<string | null>(null);
  const [isEventRankedContext, setIsEventRankedContext] = useState(false);
  const [queueSince, setQueueSince] = useState<string | null>(null);
  const [matchTipIndex, setMatchTipIndex] = useState(0);
  const matchmakingTips = [
    'Charge is strongest when used on a round where momentum aligns with your active card.',
    'Defend early against aggressive openers to preserve card HP for late rounds.',
    'Swapping before your opponent commits can blunt their strongest attack line.',
    'Track asset momentum shifts each round before locking in your action.',
    'Damage calculation is a result of attack, defense and charge affinities plus base power.',
    'The stronger your card the higher your chance of winning.',
    'Winning streaks earn you more Stark Points, but losing streaks will cost you less.',
    'You have 60 seconds to play a card per round.',
    'In Room battles, winners take all the stake.',
    'Remember to manage your card abilities strategically for maximum impact.',
    'Always consider the synergy between your cards and their abilities.',
    'Market Momentum might be a deciding factor in your chance of defeating an opponent',
  ];

  const dismissNotice = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const pushNotice = useCallback((
    tone: NoticeTone,
    title: string,
    message: string,
    duration = 4600
  ) => {
    const id = noticeCounter.current + 1;
    noticeCounter.current = id;
    setNotices((current) => [...current, { id, tone, title, message }]);
    window.setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id));
    }, duration);
  }, []);

  useEffect(() => {
    if (address) {
      fetchCards();
      fetchBots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (!isConnected || handledModeQuery) return;
    const mode = searchParams.get('mode');
    if (mode !== 'ranked') return;
    const fromEvent = searchParams.get('from_event');
    const roundsParam = Number.parseInt(searchParams.get('rounds') ?? '', 10);
    const rounds = [3, 5, 10].includes(roundsParam) ? (roundsParam as 3 | 5 | 10) : 5;
    setSelectedMode('ranked');
    setRankedTotalRounds(rounds);
    setEventContextId(fromEvent);
    setIsEventRankedContext(Boolean(fromEvent));
    if (fromEvent) {
      setShowDeckSelector(true);
    } else {
      setShowRankedSetup(true);
    }
    setHandledModeQuery(true);
    void router.replace('/lobby');
  }, [handledModeQuery, isConnected, router, searchParams]);

  useEffect(() => {
    if (matchmakingStatus !== 'searching') return;
    let cancelled = false;
    let intervalId: NodeJS.Timeout | null = null;
    let tickId: NodeJS.Timeout | null = null;
    const poll = async () => {
      try {
        const params = new URLSearchParams();
        if (queueSince) params.set('since', queueSince);
        if (isEventRankedContext && eventContextId) params.set('event_id', eventContextId);
        params.set('total_rounds', String(rankedTotalRounds));
        const res = await fetch(`/api/matches/queue/status?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (data?.match?.match_id) {
          if (cancelled) return;
          setMatchmakingStatus('idle');
          setQueueSince(null);
          const suffix = isEventRankedContext && eventContextId ? `?eventId=${eventContextId}` : '';
          const matchPath = buildMatchPath(data.match.match_id, data.match.created_at);
          router.push(`${matchPath}${suffix}`);
        }
      } catch { /* ignore */ }
    };
    intervalId = setInterval(poll, 3000);
    tickId = setInterval(() => {
      setSearchSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (tickId) clearInterval(tickId);
    };
  }, [eventContextId, isEventRankedContext, matchmakingStatus, queueSince, rankedTotalRounds, router]);

  useEffect(() => {
    if (matchmakingStatus !== 'searching') return;
    if (searchSecondsLeft > 0) return;
    const timeout = async () => {
      await fetch('/api/matches/queue/cancel', { method: 'POST' });
      setMatchmakingStatus('timeout');
      setQueueSince(null);
    };
    timeout();
  }, [matchmakingStatus, searchSecondsLeft]);

  useEffect(() => {
    if (matchmakingStatus !== 'searching') return;
    const interval = setInterval(() => {
      setMatchTipIndex((prev) => (prev + 1) % matchmakingTips.length);
    }, 9200);
    return () => clearInterval(interval);
  }, [matchmakingStatus, matchmakingTips.length]);

  const fetchCards = async () => {
    try {
      const response = await fetch(`/api/cards?wallet_address=${address}`);
      const data = await response.json();
      setCards(data.cards || []);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    }
  };

  const fetchBots = async () => {
    try {
      const response = await fetch('/api/bots');
      const data = await response.json();
      setBots(data.bots || []);
    } catch (error) {
      console.error('Failed to fetch bots:', error);
    }
  };

  const refreshRoomLists = async () => {
    setLoadingRooms(true);
    try {
      const [publicRes, mineRes] = await Promise.all([
        fetch('/api/rooms?visibility=Public'),
        fetch('/api/rooms/mine'),
      ]);
      const publicData = await publicRes.json();
      const mineData = await mineRes.json();
      setPublicRooms(publicData.rooms || []);
      setMyRooms(mineData.rooms || []);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleModeSelect = (mode: 'ranked' | 'ai' | 'warzone' | 'room') => {
    setSelectedMode(mode);
    setEventContextId(null);
    setIsEventRankedContext(false);
    setQueueSince(null);
    if (mode === 'ai') {
      setShowBotSelector(true);
    } else if (mode === 'ranked') {
      setShowRankedSetup(true);
    } else if (mode === 'warzone') {
      router.push('/events');
    } else if (mode === 'room') {
      setShowRoomModal(true);
    } else {
      setShowDeckSelector(true);
    }
  };

  const handleDeckConfirm = async (selectedCards: PlayerCard[]) => {
    if (!selectedMode || !address) return;
    try {
      const deck = selectedCards.map((c) => c.id);
      const matchData: Record<string, unknown> = {
        match_type: selectedMode === 'ai' ? 'ai' : 'ranked',
        deck,
        wallet_address: address,
      };
      if (selectedMode === 'ai') {
        matchData.total_rounds = aiTotalRounds;
        matchData.difficulty = selectedBot?.difficulty ?? 'Medium';
        matchData.bot_id = selectedBot?.bot_id;
      } else if (selectedMode === 'ranked') {
        matchData.total_rounds = rankedTotalRounds;
        matchData.from_event_context = isEventRankedContext;
        if (isEventRankedContext && eventContextId) {
          const eventIdNum = Number.parseInt(eventContextId, 10);
          if (Number.isFinite(eventIdNum)) matchData.event_id = eventIdNum;
        }
      }
      const response = await fetch('/api/matches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matchData),
      });
      const data = await response.json();
      if (data.match) {
        const suffix = isEventRankedContext && eventContextId ? `?eventId=${eventContextId}` : '';
        const matchPath = buildMatchPath(data.match.match_id, data.match.created_at);
        router.push(`${matchPath}${suffix}`);
      } else if (data.queued) {
        setMatchmakingStatus('searching');
        setQueueSince(data.queued_since || new Date().toISOString());
        setSearchSecondsLeft(45);
        pushNotice('info', 'Matchmaking Started', 'Searching for an opponent now.');
      } else if (data.error) {
        pushNotice('error', 'Match Creation Failed', String(data.error));
      }
    } catch (error) {
      console.error('Failed to create match:', error);
      pushNotice('error', 'Match Creation Failed', 'Please try again.');
    }
  };

  // --- Not connected ---
  if (!isConnected) {
    return (
      <>
        <NoticeFeed notices={notices} onDismiss={dismissNotice} />
        <div className="min-h-screen flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-sm w-full text-center"
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{
                background: 'var(--accent-primary-glow)',
                border: '1px solid var(--border-accent)',
              }}
            >
              <Swords className="w-10 h-10" style={{ color: 'var(--accent-primary)' }} />
            </div>
            <h2 className="font-display text-3xl font-black text-[var(--text-primary)] mb-2">
              Enter the Arena
            </h2>
            <p className="text-[var(--text-muted)] text-sm mb-8">
              Connect your wallet to access all game modes and start battling.
            </p>
            <ConnectWallet />
          </motion.div>
        </div>
      </>
    );
  }

  // --- Main Page ---
  return (
    <>
      <NoticeFeed notices={notices} onDismiss={dismissNotice} />
      <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-2"
        >
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-tactical font-bold tracking-[0.2em] uppercase mb-2"
            style={{
              background: 'var(--accent-primary-glow)',
              border: '1px solid var(--border-accent)',
              color: 'var(--accent-primary)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
            Battle Arena
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight text-[var(--text-primary)]">
            Choose Your Battle
          </h1>
          <p className="text-[var(--text-muted)] text-base">
            Select a mode and prove your strategy
          </p>
        </motion.div>

        {/* Mode Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODES.map((mode, i) => {
            const Icon = mode.icon;
            return (
              <motion.button
                key={mode.key}
                onClick={() => handleModeSelect(mode.key)}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07, duration: 0.4 }}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="group relative text-left rounded-2xl p-6 flex flex-col gap-4 transition-shadow"
                style={{
                  background: 'var(--bg-panel)',
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${mode.border}`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 40px ${mode.glow}`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                {/* Badge */}
                <div
                  className="absolute top-4 right-4 text-[9px] font-tactical font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded-full"
                  style={{
                    color: mode.accent,
                    background: mode.glow,
                    border: `1px solid ${mode.border}`,
                  }}
                >
                  {mode.badge}
                </div>

                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: mode.glow, border: `1px solid ${mode.border}` }}
                >
                  <Icon className="w-7 h-7 transition-transform group-hover:scale-110" style={{ color: mode.accent }} />
                </div>

                {/* Text */}
                <div className="flex-1 space-y-1.5">
                  <h3 className="font-display text-xl font-black" style={{ color: mode.accent }}>
                    {mode.label}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {mode.description}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-1.5">
                  {mode.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: mode.accent }} />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: mode.border }}>
                  <span className="text-xs font-tactical font-semibold tracking-wide" style={{ color: mode.accent }}>
                    Enter
                  </span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" style={{ color: mode.accent }} />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Footer stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl border flex divide-x overflow-hidden"
          style={{
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(12px)',
            borderColor: 'var(--border-base)',
          }}
        >
          {[
            { label: 'Cards Owned', value: cards.length },
            { label: 'Game Modes', value: 4 },
            { label: 'Ready to Play', value: cards.length >= 3 ? 'Yes' : `Need ${3 - cards.length} more` },
          ].map(({ label, value }, i) => (
            <div key={i} className="flex-1 text-center py-5 px-4" style={{ borderColor: 'var(--border-base)' }}>
              <p className="font-display text-2xl font-black text-[var(--text-primary)]">{value}</p>
              <p className="text-[10px] font-tactical tracking-wider uppercase text-[var(--text-muted)] mt-0.5">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/*  MODALS  */}
      <AnimatePresence>

        {/* Deck Selector */}
        {showDeckSelector && (
          <CardSelector
            cards={cards}
            maxSelection={3}
            onConfirm={handleDeckConfirm}
            onCancel={() => {
              setShowDeckSelector(false);
              setSelectedMode(null);
              setSelectedBot(null);
            }}
            title="Select Your Deck (3 Cards)"
          />
        )}

        {/* Ranked Setup */}
        {showRankedSetup && (
          <Overlay key="ranked-setup">
            <Modal accent="var(--border-accent)">
              <ModalHeader
                title="Ranked 1v1"
                subtitle="Auto-match against ranked opponents"
                onClose={() => { setShowRankedSetup(false); setSelectedMode(null); }}
                accent="var(--accent-primary)"
              />
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className={labelClass}>Total Rounds</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([3, 5, 10] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRankedTotalRounds(r)}
                        className="py-2.5 rounded-lg border text-sm font-display font-bold transition"
                        style={{
                          background: rankedTotalRounds === r ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                          borderColor: rankedTotalRounds === r ? 'var(--accent-primary)' : 'var(--border-base)',
                          color: rankedTotalRounds === r ? '#fff' : 'var(--text-muted)',
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className="rounded-xl p-4 text-xs text-[var(--text-muted)] leading-relaxed"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-base)' }}
                >
                  You will be matched with an opponent of similar Stark Points. Matchmaking timeout is 45 seconds.
                </div>
              </div>
              <ModalFooter>
                <BtnGhost onClick={() => { setShowRankedSetup(false); setSelectedMode(null); }}>Cancel</BtnGhost>
                <BtnPrimary onClick={() => { setShowRankedSetup(false); setShowDeckSelector(true); }}>Find Match</BtnPrimary>
              </ModalFooter>
            </Modal>
          </Overlay>
        )}

        {/* Matchmaking: Searching */}
        {matchmakingStatus === 'searching' && (
          <Overlay key="matchmaking">
            <Modal accent="var(--border-accent)" maxW="max-w-xl">
              <ModalHeader
                title="Finding Your Opponent"
                subtitle={`Matching by Stark Points  ${rankedTotalRounds} rounds`}
                accent="var(--accent-primary)"
              />
              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="flex items-center gap-5">
                  <div className="relative w-16 h-16 shrink-0">
                    <div className="absolute inset-0 rounded-full border-2 animate-spin"
                      style={{ borderColor: 'var(--border-accent)', borderTopColor: 'var(--accent-primary)' }} />
                    <div className="absolute inset-1.5 rounded-full border animate-spin"
                      style={{ borderColor: 'var(--border-base)', borderTopColor: 'var(--accent-primary)', animationDuration: '1.6s', animationDirection: 'reverse' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Users className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                    </div>
                  </div>
                  <div>
                    <p className="font-display font-bold text-[var(--text-primary)]">Searching for a balanced opponent</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Queue timer:{' '}
                      <span className="font-bold" style={{ color: searchSecondsLeft <= 10 ? '#f87171' : 'var(--text-primary)' }}>
                        {searchSecondsLeft}s
                      </span>
                    </p>
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'var(--accent-primary)' }}
                    animate={{ width: `${(searchSecondsLeft / 45) * 100};%` }}
                    transition={{ duration: 1, ease: 'linear' }}
                  />
                </div>
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-base)' }}>
                  <p className="text-[9px] font-tactical font-bold tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--accent-primary)' }}>
                    Gameplay Tip
                  </p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={matchTipIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-[var(--text-primary)] min-h-[44px] leading-relaxed"
                    >
                      {matchmakingTips[matchTipIndex]}
                    </motion.p>
                  </AnimatePresence>
                  <div className="mt-3 flex gap-1.5">
                    {matchmakingTips.map((_, idx) => (
                      <span
                        key={idx}
                        className="h-1 rounded-full transition-all duration-300"
                        style={{
                          width: idx === matchTipIndex ? '2rem' : '0.5rem',
                          background: idx === matchTipIndex ? 'var(--accent-primary)' : 'var(--border-base)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <ModalFooter>
                <BtnGhost onClick={async () => {
                  await fetch('/api/matches/queue/cancel', { method: 'POST' });
                  setMatchmakingStatus('idle');
                }}>
                  Cancel Search
                </BtnGhost>
              </ModalFooter>
            </Modal>
          </Overlay>
        )}

        {/* Matchmaking: Timeout */}
        {matchmakingStatus === 'timeout' && (
          <Overlay key="timeout">
            <Modal accent="rgba(248,113,113,0.5)" maxW="max-w-sm">
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)' }}>
                  <Users className="w-8 h-8 text-[#f87171]" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-black text-[var(--text-primary)]">No Match Found</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">No opponent available within the time limit. Try again shortly.</p>
                </div>
                <button
                  onClick={() => setMatchmakingStatus('idle')}
                  className="w-full py-2.5 rounded-lg font-tactical font-semibold text-sm transition"
                  style={{ background: 'var(--accent-primary)', color: '#fff' }}
                >
                  Close
                </button>
              </div>
            </Modal>
          </Overlay>
        )}

        {/* Room Modal */}
        {showRoomModal && (
          <Overlay key="room-modal">
            <Modal accent="rgba(52,211,153,0.4)" maxW="max-w-2xl">
              <ModalHeader
                title="Room System"
                subtitle="Create a staked room, join one, or manage your rooms"
                onClose={() => { setShowRoomModal(false); setSelectedMode(null); }}
                accent="#34d399"
              />
              <div className="px-6 pt-4 shrink-0 flex gap-1.5" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-base)' }}>
                {(['create', 'join', 'myrooms'] as const).map((tab) => {
                  const active = roomTab === tab;
                  const labels = { create: 'Create Room', join: 'Join Room', myrooms: 'My Rooms' };
                  return (
                    <button
                      key={tab}
                      onClick={async () => { setRoomTab(tab); if (tab !== 'create') await refreshRoomLists(); }}
                      className="px-4 pb-3 text-xs font-tactical font-semibold tracking-wide border-b-2 transition"
                      style={{ borderColor: active ? '#34d399' : 'transparent', color: active ? '#34d399' : 'var(--text-muted)' }}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-4">

                {roomTab === 'create' && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Visibility</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['Public', 'Private'] as const).map((v) => (
                          <button key={v} onClick={() => setRoomVisibility(v)}
                            className="py-2 rounded-lg border text-sm font-tactical font-semibold transition"
                            style={{
                              background: roomVisibility === v ? 'rgba(52,211,153,0.15)' : 'var(--bg-tertiary)',
                              borderColor: roomVisibility === v ? '#34d399' : 'var(--border-base)',
                              color: roomVisibility === v ? '#34d399' : 'var(--text-muted)',
                            }}
                          >{v}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Entry Fee (STRK)</label>
                        <input value={roomStakeFee} onChange={(e) => setRoomStakeFee(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Player Limit (2–8)</label>
                        <input type="number" min={2} max={8} value={roomMaxPlayers} onChange={(e) => setRoomMaxPlayers(Number(e.target.value))} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Total Rounds</label>
                        <div className="flex gap-1.5">
                          {([3, 5, 10] as const).map((r) => (
                            <button key={r} onClick={() => setRoomTotalRounds(r)}
                              className="flex-1 py-2 rounded-lg border text-sm font-display font-bold transition"
                              style={{
                                background: roomTotalRounds === r ? 'rgba(52,211,153,0.15)' : 'var(--bg-tertiary)',
                                borderColor: roomTotalRounds === r ? '#34d399' : 'var(--border-base)',
                                color: roomTotalRounds === r ? '#34d399' : 'var(--text-muted)',
                              }}
                            >{r}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Matches / Player (2–30)</label>
                        <input type="number" min={2} max={30} value={roomMatchesPerPlayer} onChange={(e) => setRoomMatchesPerPlayer(Number(e.target.value))} className={inputClass} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Timer (hours)</label>
                      <input type="number" min={1} max={24} value={roomTimerHours} onChange={(e) => setRoomTimerHours(Number(e.target.value))} className={inputClass} />
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">Room expires after this period. 10% treasury fee applies.</p>
                    </div>
                    <button
                      disabled={creatingRoom}
                      onClick={async () => {
                        if (!account) {
                          pushNotice('info', 'Wallet Required', 'Connect your wallet before creating a room.');
                          return;
                        }
                        setCreatingRoom(true);
                        try {
                          const stakeFeeWei = strkToWei(roomStakeFee);
                          // Step 1: approve + deposit STRK into escrow (on-chain, signed by player)
                          const depositTx = await account.execute([
                            {
                              contractAddress: STRK_TOKEN_ADDRESS,
                              entrypoint: 'approve',
                              calldata: CallData.compile([ESCROW_SYSTEM_ADDRESS, cairo.uint256(stakeFeeWei)]),
                            },
                            {
                              contractAddress: ESCROW_SYSTEM_ADDRESS,
                              entrypoint: 'deposit_stake',
                              calldata: CallData.compile([cairo.uint256(stakeFeeWei)]),
                            },
                          ]);
                          await account.waitForTransaction(depositTx.transaction_hash, {
                            retryInterval: 2000,
                            successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
                          });

                          // Step 2: tell the server to create + join the room on-chain
                          const res = await fetch('/api/rooms', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              visibility: roomVisibility,
                              stake_fee: stakeFeeWei.toString(),
                              max_players: roomMaxPlayers,
                              matches_per_player: roomMatchesPerPlayer,
                              total_rounds: roomTotalRounds,
                              timer_hours: roomTimerHours,
                            }),
                          });
                          const data = await res.json();
                          if (data.error) {
                            pushNotice('error', 'Room Creation Failed', String(data.error));
                            if (data.debug) {
                              console.error('[room/create] debug:', data.debug);
                            }
                            return;
                          }
                          if (data?.room?.room_code) {
                            setCreatedRoomCode(data.room.room_code);
                            setShowRoomModal(false);
                            pushNotice('success', 'Room Ready', `Room ${data.room.room_code} is live.`);
                          }
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : String(err);
                          pushNotice('error', 'Room Creation Failed', msg);
                        } finally {
                          setCreatingRoom(false);
                        }
                      }}
                      className="w-full py-3 rounded-xl font-tactical font-bold text-sm tracking-wide transition flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{ background: '#34d399', color: '#fff' }}
                    >
                      {creatingRoom && <Loader2 className="w-4 h-4 animate-spin" />}
                      {creatingRoom ? 'Creating...' : 'Create Room'}
                    </button>
                  </div>
                )}

                {roomTab === 'join' && (
                  <div className="space-y-5">
                    <div>
                      <label className={labelClass}>Join by Code</label>
                      <div className="flex gap-2">
                        <input
                          value={roomCode}
                          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                          className={`${inputClass} font-mono tracking-widest`}
                          placeholder="ROOM CODE"
                        />
                        <button
                          disabled={joiningRoom}
                          onClick={async () => {
                            if (!account) {
                              pushNotice('info', 'Wallet Required', 'Connect your wallet before joining a room.');
                              return;
                            }
                            setJoiningRoom(true);
                            try {
                              // Step 1: look up room to get stake_fee
                              const infoRes = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`);
                              const infoData = await infoRes.json();
                              if (infoData.error) {
                                pushNotice('error', 'Room Lookup Failed', String(infoData.error));
                                return;
                              }
                              const stakeFee = BigInt(infoData.room?.stake_fee ?? '0');

                              // Step 2: approve + deposit STRK
                              if (stakeFee > 0n) {
                                const depositTx = await account.execute([
                                  {
                                    contractAddress: STRK_TOKEN_ADDRESS,
                                    entrypoint: 'approve',
                                    calldata: CallData.compile([ESCROW_SYSTEM_ADDRESS, cairo.uint256(stakeFee)]),
                                  },
                                  {
                                    contractAddress: ESCROW_SYSTEM_ADDRESS,
                                    entrypoint: 'deposit_stake',
                                    calldata: CallData.compile([cairo.uint256(stakeFee)]),
                                  },
                                ]);
                                await account.waitForTransaction(depositTx.transaction_hash, {
                                  retryInterval: 2000,
                                  successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
                                });
                              }

                              // Step 3: server join
                              const res = await fetch('/api/rooms/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room_code: roomCode }) });
                              const data = await res.json();
                              if (data.error) {
                                pushNotice('error', 'Join Failed', String(data.error));
                                return;
                              }
                              if (data?.room_code) { setShowRoomModal(false); router.push(`/room/${data.room_code}`); }
                            } catch (err: unknown) {
                              const msg = err instanceof Error ? err.message : String(err);
                              pushNotice('error', 'Join Failed', msg);
                            } finally {
                              setJoiningRoom(false);
                            }
                          }}
                          className="px-4 py-2 rounded-lg text-sm font-tactical font-semibold transition shrink-0 flex items-center gap-1.5 disabled:opacity-60"
                          style={{ background: '#34d399', color: '#fff' }}
                        >
                          {joiningRoom && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {joiningRoom ? 'Joining...' : 'Join'}
                        </button>
                      </div>
                    </div>
                    <div className="rounded-xl border p-4" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-base)' }}>
                      <p className="text-[10px] font-tactical font-bold tracking-[0.15em] uppercase text-[var(--text-muted)] mb-3">Public Rooms</p>
                      {loadingRooms && <p className="text-xs text-[var(--text-muted)]">Loading rooms</p>}
                      {!loadingRooms && publicRooms.length === 0 && <p className="text-xs text-[var(--text-muted)]">No public rooms available.</p>}
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {publicRooms.map((room) => {
                          const joined = myRooms.some((mine) => mine.room_id === room.room_id);
                          return (
                            <div key={room.room_id} className="flex items-center justify-between rounded-lg px-3 py-2.5 border"
                              style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-base)' }}>
                              <div>
                                <span className="font-mono text-sm font-bold text-[var(--text-primary)]">{room.room_code}</span>
                                <span className="text-xs text-[var(--text-muted)] ml-3">{room.current_players}/{room.max_players} players</span>
                              </div>
                              {joined ? (
                                <button onClick={() => { setShowRoomModal(false); router.push(`/room/${room.room_code}`); }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-tactical font-semibold border border-[var(--border-base)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                                >Enter</button>
                              ) : (
                                <button
                                  disabled={joiningPublicRoomId === room.room_id}
                                  onClick={async () => {
                                    if (!account) {
                                      pushNotice('info', 'Wallet Required', 'Connect your wallet before joining a room.');
                                      return;
                                    }
                                    setJoiningPublicRoomId(room.room_id);
                                    try {
                                      const stakeFee = BigInt(room.stake_fee ?? '0');

                                      // Step 1: approve + deposit STRK
                                      if (stakeFee > 0n) {
                                        const depositTx = await account.execute([
                                          {
                                            contractAddress: STRK_TOKEN_ADDRESS,
                                            entrypoint: 'approve',
                                            calldata: CallData.compile([ESCROW_SYSTEM_ADDRESS, cairo.uint256(stakeFee)]),
                                          },
                                          {
                                            contractAddress: ESCROW_SYSTEM_ADDRESS,
                                            entrypoint: 'deposit_stake',
                                            calldata: CallData.compile([cairo.uint256(stakeFee)]),
                                          },
                                        ]);
                                        await account.waitForTransaction(depositTx.transaction_hash, {
                                          retryInterval: 2000,
                                          successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
                                        });
                                      }

                                      // Step 2: tell the server to join on-chain
                                      const res = await fetch('/api/rooms/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room_id: room.room_id }) });
                                      const data = await res.json();
                                      if (data.error) {
                                        pushNotice('error', 'Join Failed', String(data.error));
                                        return;
                                      }
                                      if (data?.room_code) { setShowRoomModal(false); router.push(`/room/${data.room_code}`); }
                                    } catch (err: unknown) {
                                      const msg = err instanceof Error ? err.message : String(err);
                                      pushNotice('error', 'Join Failed', msg);
                                    } finally {
                                      setJoiningPublicRoomId(null);
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-tactical font-semibold transition flex items-center gap-1 disabled:opacity-60"
                                  style={{ background: '#34d399', color: '#fff' }}
                                >{joiningPublicRoomId === room.room_id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}{joiningPublicRoomId === room.room_id ? 'Joining...' : 'Join'}</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {roomTab === 'myrooms' && (
                  <div className="space-y-3">
                    {loadingRooms && <p className="text-xs text-[var(--text-muted)]">Loading your rooms</p>}
                    {!loadingRooms && myRooms.length === 0 && (
                      <div className="text-center py-10 space-y-3">
                        <Shield className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-40" />
                        <p className="text-sm text-[var(--text-muted)]">You haven&apos;t joined any rooms yet.</p>
                        <button onClick={() => setRoomTab('create')}
                          className="px-4 py-2 rounded-lg text-xs font-tactical font-semibold transition"
                          style={{ background: '#34d399', color: '#fff' }}
                        >Create a Room</button>
                      </div>
                    )}
                    {myRooms.map((room) => (
                      <div key={room.room_id} className="rounded-xl border p-4 flex items-center justify-between"
                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-base)' }}>
                        <div>
                          <p className="font-mono font-bold text-[var(--text-primary)]">{room.room_code}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">{room.current_players}/{room.max_players} players &middot; {room.matches_per_player} games/player</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setShowRoomModal(false); router.push(`/room/${room.room_code}`); }}
                            className="px-3 py-1.5 rounded-lg text-xs font-tactical font-semibold transition"
                            style={{ background: '#34d399', color: '#fff' }}
                          >Enter</button>
                          <button onClick={async () => {
                            await fetch('/api/rooms/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room_id: room.room_id }) });
                            await refreshRoomLists();
                          }}
                            className="px-3 py-1.5 rounded-lg text-xs font-tactical font-semibold border border-[var(--border-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                          >Leave</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <ModalFooter>
                <BtnGhost onClick={() => { setShowRoomModal(false); setSelectedMode(null); }}>Close</BtnGhost>
              </ModalFooter>
            </Modal>
          </Overlay>
        )}

        {/* Created Room Code */}
        {createdRoomCode && (
          <Overlay key="room-created">
            <Modal accent="rgba(52,211,153,0.5)" maxW="max-w-sm">
              <div className="p-8 text-center space-y-5">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)' }}>
                  <Crown className="w-8 h-8 text-[#34d399]" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-black text-[var(--text-primary)]">Room Created</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Share this code with your opponents</p>
                </div>
                <div className="rounded-xl py-4 px-6 font-mono text-3xl font-black tracking-[0.25em]"
                  style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399' }}>
                  {createdRoomCode}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(createdRoomCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1200); } catch {}
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-tactical font-semibold transition"
                    style={{ background: '#34d399', color: '#fff' }}
                  >
                    {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {codeCopied ? 'Copied' : 'Copy Code'}
                  </button>
                  <button
                    onClick={() => { const code = createdRoomCode; setCreatedRoomCode(null); router.push(`/room/${code}`); }}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-tactical font-semibold border border-[var(--border-base)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                  >
                    <LogIn className="w-4 h-4" />
                    Go to Room
                  </button>
                </div>
                <button onClick={() => setCreatedRoomCode(null)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                  Dismiss
                </button>
              </div>
            </Modal>
          </Overlay>
        )}

        {/* Bot Selector */}
        {showBotSelector && (
          <Overlay key="bot-selector">
            <Modal accent="var(--border-accent)" maxW="max-w-3xl">
              <ModalHeader
                title="Choose Your Bot Rival"
                subtitle="Select a bot personality to battle"
                onClose={() => { setShowBotSelector(false); setSelectedMode(null); }}
                accent="var(--accent-primary)"
              />
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                <div>
                  <label className={labelClass}>Rounds (3–15)</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min={3} max={15} value={aiTotalRounds}
                      onChange={(e) => setAiTotalRounds(Number(e.target.value))}
                      className={`${inputClass} w-24`} />
                    <span className="text-xs text-[var(--text-muted)]">rounds per match</span>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {bots.map((bot) => {
                    const isEVE = bot.name === 'E.V.E';
                    const diffColor = isEVE ? '#a855f7' : bot.difficulty === 'Hard' ? '#f87171' : bot.difficulty === 'Medium' ? '#f59e0b' : 'var(--accent-primary)';
                    return (
                      <motion.button
                        key={bot.bot_id}
                        onClick={() => { setSelectedBot(bot); setShowBotSelector(false); setShowDeckSelector(true); }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className={`text-left rounded-xl border p-4 space-y-2 transition ${isEVE ? 'md:col-span-2 relative overflow-hidden' : ''}`}
                        style={{
                          background: isEVE ? 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.08))' : 'var(--bg-secondary)',
                          borderColor: isEVE ? '#a855f740' : 'var(--border-base)',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = diffColor; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = isEVE ? '#a855f740' : 'var(--border-base)'; }}
                      >
                        {isEVE && (
                          <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.07] pointer-events-none"
                            style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }} />
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isEVE && bot.avatar_url ? (
                              <div className="w-10 h-10 rounded-lg overflow-hidden ring-2 ring-purple-500/40 flex-shrink-0">
                                <Image src={bot.avatar_url} alt="E.V.E" width={40} height={40} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: `${diffColor}18`, border: `1px solid ${diffColor}40` }}>
                                <Bot className="w-4 h-4" style={{ color: diffColor }} />
                              </div>
                            )}
                            <div>
                              <h3 className={`font-display font-black text-[var(--text-primary)] ${isEVE ? 'text-lg' : 'text-base'}`}>
                                {bot.name}
                              </h3>
                              {isEVE && (
                                <span className="text-[9px] font-tactical tracking-[0.2em] uppercase text-purple-400/80">
                                  Enhanced Virtual Entity
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[9px] font-tactical font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded-full"
                            style={{ color: diffColor, background: `${diffColor}18`, border: `1px solid ${diffColor}40` }}>
                            {isEVE ? 'Legendary' : bot.difficulty}
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed ${isEVE ? 'text-purple-300/70' : 'text-[var(--text-muted)]'}`}>
                          {bot.description || 'Unpredictable and relentless.'}
                        </p>
                        {!isEVE && bot.preferred_assets && bot.preferred_assets.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {bot.preferred_assets.map((asset) => (
                              <span key={asset} className="px-2 py-0.5 rounded-full text-[10px] text-[var(--text-muted)] border border-[var(--border-base)] bg-[var(--bg-tertiary)]">
                                {asset}
                              </span>
                            ))}
                          </div>
                        )}
                        {isEVE && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="px-2 py-0.5 rounded-full text-[10px] text-purple-300/80 border border-purple-500/20 bg-purple-500/10">
                              Adaptive
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] text-purple-300/80 border border-purple-500/20 bg-purple-500/10">
                              Pattern Reader
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] text-purple-300/80 border border-purple-500/20 bg-purple-500/10">
                              All Assets
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] text-purple-300/80 border border-purple-500/20 bg-purple-500/10">
                              Dynamic Deck
                            </span>
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                  {bots.length === 0 && (
                    <div className="col-span-full text-center py-10">
                      <Bot className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-30 mb-3" />
                      <p className="text-sm text-[var(--text-muted)]">No bots available.</p>
                    </div>
                  )}
                </div>
              </div>
              <ModalFooter>
                <BtnGhost onClick={() => { setShowBotSelector(false); setSelectedMode(null); }}>Cancel</BtnGhost>
              </ModalFooter>
            </Modal>
          </Overlay>
        )}

      </AnimatePresence>
      </div>
    </>
  );
}
