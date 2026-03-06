//ccwg/ccwg-web/src/components/match/MatchArena.tsx

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMatchWebSocket } from '@/src/hooks/useMatchWebSocket';
import { RoundTimer } from './RoundTimer';
import { ActionPanel } from './ActionPanel';
import { CardDisplay } from '../cards/CardDisplay';
import { MomentumDisplay } from './MomentumDisplay';
import { OptimizedImage } from '@/src/components/ui/OptimizedImage';
import type { Match, PlayerCard, PlayerAction, CardAsset, BotCard } from '@/src/types/database';
import { generateNonce } from '@/src/lib/cartridge/utils';
import { getChallengeSwapLimit } from '@/src/lib/social/shared';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Sword, Crown, Shield, Zap, Wifi, WifiOff, LogOut } from 'lucide-react';

/* ─── helpers ─── */

function getImageUrlForAsset(asset: CardAsset): string {
  return `ccwg/cards/${asset.toLowerCase()}`;
}

/** Trigger a haptic vibration (mobile only, fails silently on desktop) */
function haptic(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch { /* non-critical */ }
}

/** Format a price string for compact display (e.g. "96432.15" → "$96.4K", "0.1234" → "$0.1234") */
function formatPrice(raw: string): string {
  const n = parseFloat(raw);
  if (isNaN(n)) return `$${raw}`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

/* ─── types ─── */

interface MatchArenaProps {
  match: Match;
  playerWallet: string;
  playerDeck: PlayerCard[];
  opponentName?: string;
  opponentAvatarUrl?: string | null;
  tournamentEventId?: string | null;
}

interface RoundStartData {
  round_number: number;
  btc_price: string;
  eth_price: string;
  strk_price: string;
  sol_price: string;
  doge_price: string;
  disable_charge: boolean;
  disable_swap: boolean;
  cloak_active: boolean;
  first_mover_wallet: string | null;
  round_end_timestamp: number;
}

interface RoundLogEntry {
  round: number;
  myAction: PlayerAction | null;
  opponentAction: PlayerAction | null;
  myMomentum: number;
  opponentMomentum: number;
  myDamageDealt: number;
  myDamageReceived: number;
  winner: string | null;
  outcome: 'win' | 'loss' | 'draw';
}

/* ─── component ─── */

export function MatchArena({
  match,
  playerWallet,
  playerDeck,
  opponentName,
  opponentAvatarUrl,
  tournamentEventId,
}: MatchArenaProps) {
  const router = useRouter();
  const isVsAI = match.mode === 'VsAI';

  const normalizeRoundLogs = (rawLogs: RoundLogEntry[]) => {
    const byRound = new Map<number, RoundLogEntry>();
    for (const log of rawLogs) {
      byRound.set(log.round, log);
    }
    return Array.from(byRound.values()).sort((a, b) => a.round - b.round);
  };

  /* ─── state ─── */
  const [currentRound, setCurrentRound] = useState(match.current_round);
  const [roundEndTimestamp, setRoundEndTimestamp] = useState(0);
  const [selectedAction, setSelectedAction] = useState<PlayerAction | null>(null);
  const [actionLocked, setActionLocked] = useState(false);
  const [opponentCard, setOpponentCard] = useState<CardAsset | null>(null);
  const [opponentCardData, setOpponentCardData] = useState<PlayerCard | BotCard | null>(null);
  const [opponentCardLoading, setOpponentCardLoading] = useState(false);
  const [opponentAction, setOpponentAction] = useState<PlayerAction | null>(null);
  const [myMomentum, setMyMomentum] = useState<number | null>(null);
  const [opponentMomentum, setOpponentMomentum] = useState<number | null>(null);
  const [roundResult, setRoundResult] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<PlayerCard | null>(playerDeck[0] || null);
  const [chargeUsed, setChargeUsed] = useState(false);
  const [chargeLocked, setChargeLocked] = useState(false);
  const [swapLocked, setSwapLocked] = useState(false);
  const [cloakActive, setCloakActive] = useState(false);
  const [swapsUsed, setSwapsUsed] = useState(0);
  const [p1Score, setP1Score] = useState(match.p1_rounds_won ?? 0);
  const [p2Score, setP2Score] = useState(match.p2_rounds_won ?? 0);
  const [roundPrices, setRoundPrices] = useState<Record<string, string> | null>(null);
  const [momentumDetails, setMomentumDetails] = useState<{
    my: { momentum: number; base: string; snapshot: string };
    opponent: { momentum: number; base: string; snapshot: string };
  } | null>(null);
  const [firstMoverWallet, setFirstMoverWallet] = useState<string | null>(null);
  const [roundStarter, setRoundStarter] = useState<'You' | 'Opponent' | null>(null);
  const [actionFeed, setActionFeed] = useState<string[]>([]);
  const [roundLogVisible, setRoundLogVisible] = useState(false);
  const [roundLogs, setRoundLogs] = useState<RoundLogEntry[]>([]);
  const [latestLog, setLatestLog] = useState<RoundLogEntry | null>(null);
  const [showSnapshotDisplay, setShowSnapshotDisplay] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [screenFlash, setScreenFlash] = useState<'win' | 'loss' | 'draw' | null>(null);
  const [reconnectSecondsLeft, setReconnectSecondsLeft] = useState<number | null>(null);

  const roundLogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const momentumByRoundRef = useRef(new Map<number, { my: number; opponent: number }>());
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const opponentCardTimeoutRoundRef = useRef<number | null>(null);

  /* ─── screen flash helper ─── */
  const triggerScreenFlash = useCallback((type: 'win' | 'loss' | 'draw') => {
    setScreenFlash(type);
    if (type === 'loss') haptic([50, 30, 100, 30, 150]);
    else if (type === 'win') haptic([30, 50, 30]);
    setTimeout(() => setScreenFlash(null), 600);
  }, []);

  /* ─── opponent card loading timeout ─── */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!opponentCard) { setOpponentCardLoading(false); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (opponentCardData) { setOpponentCardLoading(false); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpponentCardLoading(true);
    opponentCardTimeoutRoundRef.current = currentRound;
    const tid = setTimeout(() => setOpponentCardLoading(false), 1500);
    return () => clearTimeout(tid);
  }, [opponentCard, opponentCardData, currentRound]);

  const swapLimit = match.mode === 'VsAI'
    ? 999
    : match.mode === 'Challenge'
      ? getChallengeSwapLimit(match.total_rounds, match.challenge_swap_rule ?? 'Strict')
      : match.total_rounds === 10
        ? 999
        : 2;

  /* ─── WebSocket ─── */
  const {
    isConnected,
    submitAction,
    selectCard,
    swapCard,
  } = useMatchWebSocket({
    matchId: match.match_id,
    playerWallet,
    onRoundStart: (raw) => {
      const data = raw as RoundStartData;
      setCurrentRound(data.round_number);
      setIsResolving(false);
      setShowSnapshotDisplay(true);
      setRoundEndTimestamp(0);

      setRoundPrices({
        BTC: data.btc_price,
        ETH: data.eth_price,
        STRK: data.strk_price,
        SOL: data.sol_price,
        DOGE: data.doge_price,
      });

      setChargeLocked(Boolean(data.disable_charge));
      setSwapLocked(Boolean(data.disable_swap));
      setCloakActive(Boolean(data.cloak_active));

      if (data.first_mover_wallet !== undefined && data.first_mover_wallet !== null) {
        const firstMover = data.first_mover_wallet as string;
        setFirstMoverWallet(firstMover);
        const isOddRound = data.round_number % 2 === 1;
        const youAreFirstMover = firstMover === playerWallet;
        const youStartThisRound = (youAreFirstMover && isOddRound) || (!youAreFirstMover && !isOddRound);
        setRoundStarter(youStartThisRound ? 'You' : 'Opponent');
      } else {
        setRoundStarter(null);
      }

      setTimeout(() => {
        setShowSnapshotDisplay(false);
        if (!isVsAI) {
          setRoundEndTimestamp(data.round_end_timestamp);
        }
      }, 2500);

      setMomentumDetails(null);
      setSelectedAction(null);
      setActionLocked(false);
      setOpponentAction(null);
      setMyMomentum(null);
      setOpponentMomentum(null);
      setRoundResult(null);
      setRoundLogVisible(false);
      setActionFeed([]);
    },
    onOpponentCardSelected: (data) => {
      const payload = data as {
        card_asset: string;
        card?: PlayerCard | BotCard | null;
        opponent_wallet?: string;
        round_number?: number;
        match_id?: number;
      };

      setOpponentCard(payload.card_asset as CardAsset);

      if (payload.card?.template) {
        setOpponentCardData(payload.card);
        setOpponentCardLoading(false);
      } else {
        setOpponentCardData(null);
        setOpponentCardLoading(false);
      }

      setActionFeed((prev) => [
        `${opponentName || 'Opponent'} revealed ${payload.card_asset}.`,
        ...prev.slice(0, 4),
      ]);
    },
    onOpponentActionLocked: (raw) => {
      const data = raw as { action: PlayerAction };
      setOpponentAction(data.action);
      const card = opponentCardData?.template?.asset || opponentCard || 'Unknown';
      setActionFeed((prev) => [
        cloakActive
          ? `${opponentName || 'Opponent'} locked an action.`
          : `${opponentName || 'Opponent'} locked ${data.action} with ${card}.`,
        ...prev.slice(0, 4),
      ]);
    },
    onMomentumReveal: (raw) => {
      const data = raw as {
        cloak_active?: boolean;
        round_number: number;
        p1_momentum_percent: number;
        p2_momentum_percent: number;
        p1_base_price: number;
        p2_base_price: number;
        p1_snapshot_price: number;
        p2_snapshot_price: number;
      };
      if (typeof data.cloak_active === 'boolean') {
        setCloakActive(data.cloak_active);
      }
      const isPlayer1 = playerWallet === match.player_1;
      const myMomentumValue = isPlayer1 ? data.p1_momentum_percent : data.p2_momentum_percent;
      const opponentMomentumValue = isPlayer1 ? data.p2_momentum_percent : data.p1_momentum_percent;
      setMyMomentum(myMomentumValue);
      setOpponentMomentum(opponentMomentumValue);
      momentumByRoundRef.current.set(data.round_number, {
        my: myMomentumValue,
        opponent: opponentMomentumValue,
      });
      setMomentumDetails({
        my: {
          momentum: myMomentumValue,
          base: String(isPlayer1 ? data.p1_base_price : data.p2_base_price),
          snapshot: String(isPlayer1 ? data.p1_snapshot_price : data.p2_snapshot_price),
        },
        opponent: {
          momentum: opponentMomentumValue,
          base: String(isPlayer1 ? data.p2_base_price : data.p1_base_price),
          snapshot: String(isPlayer1 ? data.p2_snapshot_price : data.p1_snapshot_price),
        },
      });

      setLatestLog((prev) => {
        if (!prev || prev.round !== data.round_number) return prev;
        return { ...prev, myMomentum: myMomentumValue, opponentMomentum: opponentMomentumValue };
      });
      setRoundLogs((prev) => {
        if (prev.length === 0) return prev;
        let didUpdate = false;
        const next = prev.map((log) => {
          if (log.round !== data.round_number) return log;
          didUpdate = true;
          return { ...log, myMomentum: myMomentumValue, opponentMomentum: opponentMomentumValue };
        });
        if (didUpdate) {
          try {
            sessionStorage.setItem(`ccwg:match:${match.match_id}:roundLogs`, JSON.stringify(next));
          } catch { /* non-critical */ }
        }
        return next;
      });
    },
    onRoundEnd: (raw) => {
      const data = raw as {
        cloak_active?: boolean;
        winner: string | null;
        p1_rounds_won: number;
        p2_rounds_won: number;
        round_number: number;
        p1_damage: number;
        p2_damage: number;
      };
      if (typeof data.cloak_active === 'boolean') {
        setCloakActive(data.cloak_active);
      }
      let outcome: 'win' | 'loss' | 'draw' = 'draw';
      if (data.winner === playerWallet) outcome = 'win';
      else if (data.winner === (match.player_1 === playerWallet ? match.player_2 : match.player_1)) {
        outcome = 'loss';
      }
      setRoundResult(outcome);
      setP1Score(data.p1_rounds_won ?? 0);
      setP2Score(data.p2_rounds_won ?? 0);

      triggerScreenFlash(outcome);

      const isPlayer1 = playerWallet === match.player_1;
      const roundMomentum = momentumByRoundRef.current.get(data.round_number);
      const logEntry: RoundLogEntry = {
        round: data.round_number,
        myAction: selectedAction,
        opponentAction,
        myMomentum: roundMomentum?.my ?? myMomentum ?? 0,
        opponentMomentum: roundMomentum?.opponent ?? opponentMomentum ?? 0,
        myDamageDealt: isPlayer1 ? data.p1_damage : data.p2_damage,
        myDamageReceived: isPlayer1 ? data.p2_damage : data.p1_damage,
        winner: data.winner,
        outcome,
      };

      setLatestLog(logEntry);
      setRoundLogs((prev) => {
        const next = normalizeRoundLogs([...prev, logEntry]);
        try {
          sessionStorage.setItem(`ccwg:match:${match.match_id}:roundLogs`, JSON.stringify(next));
        } catch { /* non-critical */ }
        return next;
      });

      setRoundLogVisible(true);
      if (roundLogTimerRef.current) clearTimeout(roundLogTimerRef.current);
      roundLogTimerRef.current = setTimeout(() => {
        setRoundLogVisible(false);
      }, 10000);
    },
    onMatchEnd: () => {
      const suffix = tournamentEventId ? `?eventId=${encodeURIComponent(tournamentEventId)}` : '';
      router.push(`/match/${match.match_id}/results${suffix}`);
    },
    onError: (error) => {
      console.error('[ERROR]', error);
    },
  });

  /* ─── effects ─── */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isConnected) setRoundEndTimestamp(0);
  }, [isConnected]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`ccwg:match:${match.match_id}:roundLogs`);
      if (stored) {
        Promise.resolve().then(() => {
          setRoundLogs(normalizeRoundLogs(JSON.parse(stored)));
        });
      }
    } catch { /* non-critical */ }
  }, [match.match_id]);

  useEffect(() => {
    return () => {
      if (roundLogTimerRef.current) clearTimeout(roundLogTimerRef.current);
      if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isConnected || !activeCard) return;
    selectCard(activeCard.id, currentRound);
  }, [activeCard, currentRound, isConnected, selectCard]);

  useEffect(() => {
    if (!activeCard && playerDeck.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveCard(playerDeck[0]);
    }
  }, [activeCard, playerDeck]);

  useEffect(() => {
    if (selectedAction && opponentAction && !isResolving && !roundLogVisible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsResolving(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoundEndTimestamp(0);
    }
  }, [selectedAction, opponentAction, isResolving, roundLogVisible]);

  useEffect(() => {
    if (roundLogVisible && isResolving) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsResolving(false);
    }
  }, [roundLogVisible, isResolving]);

  /* ─── reconnect grace period ─── */
  useEffect(() => {
    if (isConnected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReconnectSecondsLeft(null);
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      return;
    }
    const graceSeconds = match.total_rounds === 10 ? 90 : match.total_rounds === 5 ? 60 : 30;
    let remaining = graceSeconds;
    setReconnectSecondsLeft(remaining);
    if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);
    reconnectTimerRef.current = setInterval(() => {
      remaining -= 1;
      setReconnectSecondsLeft(remaining);
      if (remaining <= 0) {
        if (reconnectTimerRef.current) {
          clearInterval(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        fetch(`/api/matches/${match.match_id}/forfeit?wallet_address=${playerWallet}`, {
          method: 'POST',
        }).finally(() => {
          router.push('/lobby');
        });
      }
    }, 1000);
    return () => {
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [isConnected, match.match_id, match.total_rounds, playerWallet, router]);

  /* ─── action handlers ─── */
  const handleActionSelect = (action: PlayerAction) => {
    if (actionLocked || !isConnected) return;
    if (action === 'Charge' && chargeLocked) return;
    // Mutual charge exclusion: if opponent already played Charge this round, block player
    if (action === 'Charge' && opponentAction === 'Charge') return;

    setSelectedAction(action);
    const myAsset = activeCard?.template?.asset || 'Unknown';
    setActionFeed((prev) => [
      `You locked ${action} with ${myAsset}.`,
      ...prev.slice(0, 4),
    ]);
    const nonce = generateNonce();
    submitAction(action, currentRound, nonce);
    if (action === 'Charge') setChargeUsed(true);
    setActionLocked(true);
    haptic([40, 20, 60]);
  };

  const handleCardSwap = (newCard: PlayerCard) => {
    if (swapsUsed >= swapLimit || !isConnected || swapLocked) return;
    swapCard(newCard.id, currentRound);
    setActiveCard(newCard);
    setSwapsUsed((prev) => prev + 1);
    haptic(30);
  };

  /* ─── derived state ─── */
  const isFirstMover = roundStarter === 'You';
  const opponentCardReady = Boolean(opponentCard);
  const chargeBlocked = chargeUsed || chargeLocked || opponentAction === 'Charge';
  const canAct =
    isConnected &&
    !showSnapshotDisplay &&
    !actionLocked &&
    opponentCardReady &&
    (roundStarter === 'You' || Boolean(opponentAction));
  const [forfeitConfirm, setForfeitConfirm] = useState(false);

  const handleForfeit = useCallback(async () => {
    try {
      await fetch(`/api/matches/${match.match_id}/forfeit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: playerWallet }),
      });
    } catch { /* best-effort */ }
    router.push(`/match/${match.match_id}/results`);
  }, [match.match_id, playerWallet, router]);
  const yourTimerPaused =
    isVsAI || !isConnected || showSnapshotDisplay || isResolving || actionLocked || !opponentCardReady || (!isFirstMover && !opponentAction);
  const opponentTimerPaused =
    isVsAI || !isConnected || showSnapshotDisplay || isResolving || Boolean(opponentAction) || !opponentCardReady || (isFirstMover && !selectedAction);
  const myScore = playerWallet === match.player_1 ? p1Score : p2Score;
  const opponentScore = playerWallet === match.player_1 ? p2Score : p1Score;

  /* ─── action icon helper ─── */
  const getActionIcon = (action: string | null, size = 'w-4 h-4') => {
    switch (action) {
      case 'Attack': return <Sword className={`${size} text-red-400`} />;
      case 'Defend': return <Shield className={`${size} text-blue-400`} />;
      case 'Charge': return <Zap className={`${size} text-yellow-400`} />;
      default: return null;
    }
  };

  /* ─── render ─── */
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--bg-primary, #0a0a0f)' }}>
      {/* Screen Flash Overlay */}
      <AnimatePresence>
        {screenFlash && (
          <motion.div
            key="screenFlash"
            className="fixed inset-0 z-[60] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              background:
                screenFlash === 'win'
                  ? 'radial-gradient(circle, rgba(34,197,94,0.6) 0%, transparent 70%)'
                  : screenFlash === 'loss'
                    ? 'radial-gradient(circle, rgba(239,68,68,0.6) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(234,179,8,0.4) 0%, transparent 70%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Arena Preparing Overlay */}
      <AnimatePresence>
        {showSnapshotDisplay && (
          <motion.div
            key="snapshot-overlay"
            className="fixed inset-0 z-40 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center px-4">
              <motion.div
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <Swords className="w-14 h-14 text-[var(--accent-primary)] mx-auto mb-4" />
              </motion.div>
              <motion.p
                className="text-2xl font-bold text-[var(--text-primary)] mb-2"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                Round {currentRound} — Arena Preparing
              </motion.p>
              <p className="text-sm text-[var(--text-muted)] mb-6">Fetching price snapshots</p>

              {roundPrices && (
                <motion.div
                  className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-w-lg mx-auto"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  {Object.entries(roundPrices).map(([asset, price], i) => (
                    <motion.div
                      key={asset}
                      className="rounded-lg px-2 py-2 border border-[var(--border-base)] text-center"
                      style={{ background: 'var(--bg-secondary)' }}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2 + i * 0.08 }}
                    >
                      <div className="text-[10px] text-[var(--text-muted)] uppercase">{asset}</div>
                      <div className="font-semibold text-sm text-[var(--text-primary)]">{formatPrice(price)}</div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              <motion.p
                className="text-xs text-[var(--text-muted)] mt-4"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Timer starts in a moment...
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="relative z-10 p-3 sm:p-4 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          className="mb-4 sm:mb-6"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <motion.div
                animate={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Swords className="w-6 h-6 sm:w-7 sm:h-7 text-[var(--accent-primary)]" />
              </motion.div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                  Round {currentRound}
                  <span className="text-[var(--text-muted)] font-normal text-sm ml-2">
                    / {match.total_rounds}
                  </span>
                </h1>
                <p className="text-xs text-[var(--text-muted)]">
                  {match.mode === 'VsAI'
                    ? 'VS BOT'
                    : match.mode === 'Challenge'
                      ? 'Friendly Challenge'
                      : 'Ranked Match'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setForfeitConfirm(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Quit</span>
              </button>

              <div className="flex items-center gap-1.5">
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                ) : (
                  <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                    <WifiOff className="w-4 h-4 text-red-400" />
                  </motion.div>
                )}
                <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
                  {isConnected ? 'Live' : 'Reconnecting'}
                </span>
              </div>
            </div>
          </div>

          {/* Scoreboard */}
          <div className="mt-3 flex items-center justify-center">
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-2 border border-[var(--border-base)]"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <span className="text-sm font-semibold text-[var(--text-primary)]">You</span>
              <motion.span
                className="text-lg font-bold text-[var(--accent-primary)]"
                key={`my-${myScore}`}
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
              >
                {myScore}
              </motion.span>
              <span className="text-[var(--text-muted)] text-xs">vs</span>
              <motion.span
                className="text-lg font-bold text-[var(--accent-primary)]"
                key={`opp-${opponentScore}`}
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
              >
                {cloakActive ? '?' : opponentScore}
              </motion.span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
                {opponentAvatarUrl && (
                  <img src={opponentAvatarUrl} alt="" className="w-5 h-5 rounded-full ring-1 ring-purple-500/40" />
                )}
                {match.mode === 'VsAI' ? (opponentName || 'Bot') : (opponentName || 'Opponent')}
              </span>
            </div>
          </div>

          {roundStarter && (
            <motion.p
              className="mt-2 text-center text-xs text-[var(--accent-primary)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {roundStarter === 'You'
                ? 'You start this round. Make the first move.'
                : `${opponentName || 'Opponent'} starts this round.`}
            </motion.p>
          )}
        </motion.div>

        {/* Connection lost banner */}
        <AnimatePresence>
          {!isConnected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 rounded-xl border border-red-500/40 p-3 text-center overflow-hidden"
              style={{ background: 'rgba(127,29,29,0.2)' }}
            >
              <p className="text-red-300 font-semibold text-sm">Connection lost. Reconnecting...</p>
              {reconnectSecondsLeft !== null && (
                <p className="text-xs text-red-400 mt-1">
                  Reconnect within {reconnectSecondsLeft}s or match will be forfeited.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timers */}
        {!isVsAI && (
          <div className="mb-4 sm:mb-6 grid grid-cols-2 gap-2 sm:gap-3">
            <RoundTimer
              label="Your Timer"
              roundEndTimestamp={roundEndTimestamp}
              paused={yourTimerPaused}
              onTimeout={() => {
                if (!actionLocked && isConnected && !showSnapshotDisplay) {
                  handleActionSelect('Defend');
                }
              }}
            />
            <RoundTimer
              label={`${opponentName || 'Opponent'}`}
              roundEndTimestamp={roundEndTimestamp}
              paused={opponentTimerPaused}
            />
          </div>
        )}

        {/* Resolution Phase — Swords Clanking */}
        <AnimatePresence>
          {isResolving && !roundLogVisible && (
            <motion.div
              key="resolving"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mb-4 sm:mb-6 rounded-xl border border-[var(--accent-primary)]/30 p-6 sm:p-8 text-center"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <div className="flex items-center justify-center gap-1 mb-3">
                <motion.div
                  animate={{ rotate: [0, 25, -5, 20, 0], x: [0, 8, -2, 6, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Sword className="w-10 h-10 text-red-400" />
                </motion.div>

                <motion.div
                  animate={{ scale: [0.5, 1.4, 0.5], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.4, repeat: Infinity }}
                  className="text-yellow-400 text-2xl font-bold mx-1"
                >
                  ⚔
                </motion.div>

                <motion.div
                  animate={{ rotate: [0, -25, 5, -20, 0], x: [0, -8, 2, -6, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ transform: 'scaleX(-1)' }}
                >
                  <Sword className="w-10 h-10 text-blue-400" />
                </motion.div>
              </div>

              <motion.p
                className="text-lg font-bold text-[var(--text-primary)]"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                Battling...
              </motion.p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Calculating momentum & damage</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Price Snapshot (inline) */}
        {roundPrices && !showSnapshotDisplay && (
          <div
            className="mb-4 sm:mb-6 rounded-xl border border-[var(--border-base)] p-3"
            style={{ background: 'var(--bg-secondary)' }}
          >
            <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">Round Snapshot</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-sm">
              {Object.entries(roundPrices).map(([asset, price]) => (
                <div
                  key={asset}
                  className="rounded-lg px-2 py-1.5 text-center border border-[var(--border-base)]"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <div className="text-[9px] text-[var(--text-muted)] uppercase">{asset}</div>
                  <div className="font-semibold text-xs text-[var(--text-primary)]">{formatPrice(price)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Momentum Reveal */}
        {momentumDetails && (
          <div
            className="mb-4 sm:mb-6 rounded-xl border border-[var(--border-base)] p-3"
            style={{ background: 'var(--bg-secondary)' }}
          >
            <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">Momentum Reveal</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg px-3 py-2 border border-[var(--border-base)]" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="text-xs text-[var(--text-muted)]">You</div>
                <div className="font-semibold text-[var(--text-primary)]">
                  {cloakActive ? 'Hidden' : `${((momentumDetails.my.momentum ?? 0) / 100).toFixed(3)}%`}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  {cloakActive ? 'Hidden' : `$${momentumDetails.my.base} → $${momentumDetails.my.snapshot}`}
                </div>
              </div>
              <div className="rounded-lg px-3 py-2 border border-[var(--border-base)]" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="text-xs text-[var(--text-muted)]">{opponentName || 'Opponent'}</div>
                <div className="font-semibold text-[var(--text-primary)]">
                  {cloakActive ? 'Hidden' : `${((momentumDetails.opponent.momentum ?? 0) / 100).toFixed(3)}%`}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  {cloakActive ? 'Hidden' : `$${momentumDetails.opponent.base} → $${momentumDetails.opponent.snapshot}`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cards Display */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
          {/* Your card */}
          <motion.div
            className="space-y-2 sm:space-y-3"
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] text-center">Your Card</h3>

            <div className="flex justify-center">
              {activeCard ? (
                <CardDisplay card={activeCard} size="large" />
              ) : (
                <div
                  className="w-48 sm:w-64 h-64 sm:h-88 rounded-xl flex items-center justify-center border border-[var(--border-base)]"
                  style={{ background: 'var(--bg-secondary)' }}
                >
                  <p className="text-[var(--text-muted)] text-sm">Loading deck...</p>
                </div>
              )}
            </div>

            {!cloakActive && activeCard && myMomentum !== null && (
              <MomentumDisplay
                momentum={myMomentum}
                cardAsset={activeCard.template?.asset || 'UNKNOWN'}
                revealed={true}
              />
            )}
          </motion.div>

          {/* Opponent card */}
          <motion.div
            className="space-y-2 sm:space-y-3"
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] text-center">
              {match.mode === 'VsAI' ? (opponentName || 'Bot') : (opponentName || 'Opponent')}&apos;s Card
            </h3>

            <div className="flex justify-center">
              {opponentCardData ? (
                <CardDisplay card={opponentCardData} size="large" />
              ) : opponentCardLoading ? (
                <div
                  className="w-48 sm:w-64 h-64 sm:h-88 rounded-xl border border-[var(--border-accent)] relative overflow-hidden"
                  style={{ background: 'var(--bg-secondary)' }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-xs text-[var(--text-muted)]">Loading card…</div>
                  </div>
                </div>
              ) : opponentCard ? (
                <div className="w-48 sm:w-64 h-64 sm:h-88 rounded-xl overflow-hidden border-2 border-[var(--border-accent)] relative">
                  <OptimizedImage
                    publicId={getImageUrlForAsset(opponentCard)}
                    alt={opponentCard}
                    transformation="CARD_FULL"
                    className="w-full h-full"
                    priority={true}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2.5">
                    <p className="text-white font-bold text-sm">{opponentCard}</p>
                    {opponentAction && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {getActionIcon(opponentAction)}
                        <span className="text-xs text-[var(--accent-primary)]">{opponentAction}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="w-48 sm:w-64 h-64 sm:h-88 rounded-xl flex items-center justify-center border border-[var(--border-base)]"
                  style={{ background: 'var(--bg-secondary)' }}
                >
                  <motion.div
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-[var(--text-muted)] text-xs text-center px-4"
                  >
                    Waiting for opponent...
                  </motion.div>
                </div>
              )}
            </div>

            {!cloakActive && opponentMomentum !== null && (opponentCard || opponentCardData) && (
              <MomentumDisplay
                momentum={opponentMomentum}
                cardAsset={opponentCardData?.template?.asset || opponentCard || 'UNKNOWN'}
                revealed={true}
              />
            )}
          </motion.div>
        </div>

        {/* Battle Field */}
        <AnimatePresence>
          {actionFeed.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 sm:mb-6 rounded-xl border border-[var(--border-base)] overflow-hidden"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Swords className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <h3 className="text-[10px] uppercase tracking-widest text-[var(--accent-primary)] font-bold">
                    Battle Field
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {actionFeed.map((line, idx) => (
                    <motion.div
                      key={`${line}-${idx}`}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] border border-[var(--border-base)]"
                      style={{ background: 'var(--bg-tertiary)' }}
                    >
                      {line}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Panel */}
        <div className="mb-4 sm:mb-6">
          <ActionPanel
            onActionSelect={handleActionSelect}
            chargeAvailable={!chargeBlocked}
            disabled={!canAct}
            selectedAction={selectedAction}
          />
          <AnimatePresence>
            {selectedAction && !opponentAction && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center text-xs text-[var(--text-muted)] mt-2"
              >
                Waiting for {opponentName || 'opponent'} to lock their action...
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Deck Swap */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Your Deck</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Swaps: {swapsUsed}/{swapLimit === 999 ? '∞' : swapLimit}
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3 justify-center overflow-x-auto pb-1">
            {playerDeck.map((card) => (
              <CardDisplay
                key={card.id}
                card={card}
                size="small"
                selected={activeCard ? card.id === activeCard.id : false}
                disabled={(activeCard ? card.id === activeCard.id : false) || swapsUsed >= swapLimit || swapLocked}
                onClick={() => handleCardSwap(card)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Round Result Overlay */}
      <AnimatePresence>
        {forfeitConfirm && (
          <motion.div
            key="forfeit-confirm"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-xl border border-red-500/30 p-6 text-center"
              style={{ background: 'var(--bg-panel)' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <LogOut className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Forfeit Match?</h2>
              <p className="text-sm text-[var(--text-muted)] mb-5">
                Your opponent will be awarded the remaining rounds. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setForfeitConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--border-base)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleForfeit}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-bold hover:bg-red-500/30 transition-colors"
                >
                  Forfeit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {roundLogVisible && (
          <motion.div
            key="roundResult"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md"
              initial={{ scale: 0.7, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.7, opacity: 0, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {/* Result header */}
              <div className="text-center mb-4">
                {cloakActive ? (
                  <h2 className="text-3xl sm:text-4xl font-black text-[var(--accent-primary)]">ROUND COMPLETE</h2>
                ) : (
                  <>
                    {roundResult === 'win' && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                        <Crown className="w-14 h-14 sm:w-16 sm:h-16 text-yellow-500 mx-auto mb-2" />
                        <h2 className="text-3xl sm:text-4xl font-black text-yellow-400">ROUND WON</h2>
                      </motion.div>
                    )}
                    {roundResult === 'loss' && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                        <Sword className="w-14 h-14 sm:w-16 sm:h-16 text-red-500 mx-auto mb-2 rotate-45" />
                        <h2 className="text-3xl sm:text-4xl font-black text-red-400">ROUND LOST</h2>
                      </motion.div>
                    )}
                    {roundResult === 'draw' && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                        <Swords className="w-14 h-14 sm:w-16 sm:h-16 text-[var(--text-muted)] mx-auto mb-2" />
                        <h2 className="text-3xl sm:text-4xl font-black text-[var(--text-muted)]">ROUND DRAW</h2>
                      </motion.div>
                    )}
                  </>
                )}
              </div>

              {/* Result details card */}
              <div
                className="rounded-xl border border-[var(--border-base)] p-4 sm:p-5"
                style={{ background: 'var(--bg-panel)' }}
              >
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[var(--text-muted)] text-xs mb-0.5">Your Action</p>
                    <div className="flex items-center gap-1.5">
                      {getActionIcon(latestLog?.myAction ?? null)}
                      <span className="text-[var(--text-primary)] font-semibold">{latestLog?.myAction ?? 'Defend'}</span>
                    </div>
                    {latestLog?.myAction === 'Charge' && (
                      <p className="text-[10px] text-yellow-400 mt-0.5">Ability Activated</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-xs mb-0.5">Opponent Action</p>
                    <div className="flex items-center gap-1.5">
                      {!cloakActive && getActionIcon(latestLog?.opponentAction ?? null)}
                      <span className="text-[var(--text-primary)] font-semibold">
                        {cloakActive ? 'Hidden' : latestLog?.opponentAction ?? 'Defend'}
                      </span>
                    </div>
                    {!cloakActive && latestLog?.opponentAction === 'Charge' && (
                      <p className="text-[10px] text-yellow-400 mt-0.5">Ability Activated</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-xs mb-0.5">Your Momentum</p>
                    <p className="text-[var(--text-primary)] font-semibold">
                      {cloakActive ? 'Hidden' : `${((latestLog?.myMomentum ?? 0) / 100).toFixed(3)}%`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-xs mb-0.5">Opponent Momentum</p>
                    <p className="text-[var(--text-primary)] font-semibold">
                      {cloakActive ? 'Hidden' : `${((latestLog?.opponentMomentum ?? 0) / 100).toFixed(3)}%`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-xs mb-0.5">Damage Dealt</p>
                    <p className="text-emerald-400 font-bold text-lg">{latestLog?.myDamageDealt ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-xs mb-0.5">Damage Received</p>
                    <p className="text-red-400 font-bold text-lg">{latestLog?.myDamageReceived ?? 0}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--border-base)]">
                  <p className="text-[var(--text-muted)] text-xs">Round Winner</p>
                  <p className="text-[var(--text-primary)] font-bold">
                    {cloakActive
                      ? 'Hidden'
                      : latestLog?.winner
                        ? latestLog.winner === playerWallet
                          ? 'You'
                          : opponentName || 'Opponent'
                        : 'Draw'}
                  </p>
                </div>

                <motion.p
                  className="text-[10px] text-[var(--text-muted)] mt-3 text-center"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Next round starts in a few seconds...
                </motion.p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
