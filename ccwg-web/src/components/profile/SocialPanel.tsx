'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Swords, Shield, Search, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { CardSelector } from '@/src/components/cards/CardSelector';
import type { PlayerCard } from '@/src/types/database';

type FriendItem = {
  wallet_address: string;
  username: string | null;
  online: boolean;
  last_seen: string | null;
};

type FriendRequestItem = {
  request_id: number;
  direction: 'incoming' | 'outgoing';
  wallet_address: string;
  username: string | null;
  created_at: string;
};

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

type SearchResult = {
  wallet_address: string;
  username: string | null;
};

type OverviewPayload = {
  friends: FriendItem[];
  friend_requests: FriendRequestItem[];
  challenges: ChallengeItem[];
  limits: {
    friend_requests_per_day: number;
  };
};

type WaitingChallengeState = {
  matchId: number;
  targetWallet: string;
  targetName: string;
  waitUntilMs: number;
};

const shortWallet = (value: string) => `${value.slice(0, 8)}...${value.slice(-6)}`;
const CHALLENGE_WAIT_WINDOW_MS = 45_000;

export function SocialPanel({ walletAddress }: { walletAddress: string }) {
  const router = useRouter();
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendItem | null>(null);
  const [challengeRounds, setChallengeRounds] = useState<3 | 5 | 10>(5);
  const [challengeRule, setChallengeRule] = useState<'Fun' | 'Strict'>('Strict');
  const [showDeckSelector, setShowDeckSelector] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [waitingChallenge, setWaitingChallenge] = useState<WaitingChallengeState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [blockingMatchId, setBlockingMatchId] = useState<number | null>(null);
  const [quittingMatch, setQuittingMatch] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/social/overview', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load social data');
      setOverview(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load social data';
      setFeedback({ tone: 'error', text: message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    const intervalId = window.setInterval(() => {
      void loadOverview();
    }, 12000);
    return () => window.clearInterval(intervalId);
  }, [loadOverview]);

  const runFriendAction = async (payload: Record<string, unknown>, busy: string) => {
    setBusyKey(busy);
    setFeedback(null);
    try {
      const res = await fetch('/api/social/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Friend action failed');
      await loadOverview();
      setFeedback({ tone: 'success', text: 'Friend action completed.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Friend action failed';
      setFeedback({ tone: 'error', text: message });
    } finally {
      setBusyKey(null);
    }
  };

  const runChallengeAction = async (
    payload: Record<string, unknown>,
    busy: string,
    successText: string,
    routeToMatch = false
  ) => {
    setBusyKey(busy);
    setFeedback(null);
    try {
      const res = await fetch('/api/social/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.blocking_match_id) {
          setBlockingMatchId(data.blocking_match_id as number);
          return null;
        }
        throw new Error(data?.error || 'Challenge action failed');
      }
      await loadOverview();
      setFeedback({ tone: 'success', text: successText });
      if (routeToMatch && data?.match_id) {
        router.push(`/match/${data.match_id}`);
      }
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Challenge action failed';
      setFeedback({ tone: 'error', text: message });
      return null;
    } finally {
      setBusyKey(null);
    }
  };

  const handleQuitBlockingMatch = async () => {
    if (!blockingMatchId) return;
    setQuittingMatch(true);
    try {
      const res = await fetch(`/api/matches/${blockingMatchId}/forfeit`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setFeedback({ tone: 'error', text: data?.error || 'Failed to quit match.' });
        return;
      }
      setBlockingMatchId(null);
      setFeedback({ tone: 'success', text: 'Match quit. You can now send a challenge.' });
    } catch {
      setFeedback({ tone: 'error', text: 'Failed to quit match.' });
    } finally {
      setQuittingMatch(false);
    }
  };

  const handleSearch = async () => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/player/search?q=${encodeURIComponent(term)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Search failed');
      setResults(data.players || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed';
      setFeedback({ tone: 'error', text: message });
    } finally {
      setSearching(false);
    }
  };

  const openChallengeComposer = async (friend: FriendItem) => {
    setSelectedFriend(friend);
    setChallengeRounds(5);
    setChallengeRule('Strict');
    setShowDeckSelector(false);
    setFeedback(null);
  };

  const openDeckSelector = async () => {
    if (!selectedFriend) return;
    if (cards.length > 0) {
      setShowDeckSelector(true);
      return;
    }

    setCardsLoading(true);
    try {
      const res = await fetch(`/api/cards?wallet_address=${walletAddress}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load cards');
      const availableCards = data.cards || [];
      setCards(availableCards);
      if (availableCards.length < 3) {
        throw new Error('You need at least 3 cards to send a challenge.');
      }
      setShowDeckSelector(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load cards';
      setFeedback({ tone: 'error', text: message });
    } finally {
      setCardsLoading(false);
    }
  };

  const submitChallengeWithDeck = async (selectedCards: PlayerCard[]) => {
    if (!selectedFriend) return;
    const deck = selectedCards.map((card) => card.id);
    setShowDeckSelector(false);
    const targetWallet = selectedFriend.wallet_address;
    const targetName = selectedFriend.username || shortWallet(selectedFriend.wallet_address);
    const data = await runChallengeAction(
      {
        action: 'send',
        target_wallet: targetWallet,
        total_rounds: challengeRounds,
        swap_rule: challengeRule,
        deck,
      },
      `challenge-send-${targetWallet}`,
      'Challenge sent.',
      false
    );
    if (data?.match_id) {
      setWaitingChallenge({
        matchId: Number(data.match_id),
        targetWallet,
        targetName,
        waitUntilMs: Date.now() + CHALLENGE_WAIT_WINDOW_MS,
      });
      setSelectedFriend(null);
    }
  };

  const friendRequestMap = useMemo(() => {
    const map = new Map<string, 'incoming' | 'outgoing'>();
    for (const req of overview?.friend_requests || []) {
      map.set(req.wallet_address.toLowerCase(), req.direction);
    }
    return map;
  }, [overview?.friend_requests]);

  const friendWalletSet = useMemo(
    () => new Set((overview?.friends || []).map((friend) => friend.wallet_address.toLowerCase())),
    [overview?.friends]
  );

  const incomingRequests = (overview?.friend_requests || []).filter((item) => item.direction === 'incoming');
  const outgoingRequests = (overview?.friend_requests || []).filter((item) => item.direction === 'outgoing');
  const incomingChallenges = (overview?.challenges || []).filter((item) => item.direction === 'incoming');
  const outgoingChallenges = (overview?.challenges || []).filter((item) => item.direction === 'outgoing');
  const waitingChallengeRow = waitingChallenge
    ? outgoingChallenges.find((item) => item.match_id === waitingChallenge.matchId)
    : null;

  useEffect(() => {
    if (!waitingChallenge) return;
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [waitingChallenge]);

  useEffect(() => {
    if (!waitingChallenge || !waitingChallengeRow) return;
    if (waitingChallengeRow.status === 'Accepted') {
      setWaitingChallenge(null);
      router.push(`/match/${waitingChallengeRow.match_id}-${Date.now().toString(36)}`);
    }
  }, [router, waitingChallenge, waitingChallengeRow]);

  useEffect(() => {
    if (!waitingChallenge) return;
    if (nowMs < waitingChallenge.waitUntilMs) return;
    setWaitingChallenge(null);
    setFeedback({
      tone: 'info',
      text: 'Challenge is still pending. You can manage it in Outgoing Challenges.',
    });
  }, [nowMs, waitingChallenge]);

  const waitingSeconds = waitingChallenge
    ? Math.max(0, Math.ceil((waitingChallenge.waitUntilMs - nowMs) / 1000))
    : 0;

  return (
    <>
      {showDeckSelector && selectedFriend && (
        <CardSelector
          cards={cards}
          maxSelection={3}
          onConfirm={submitChallengeWithDeck}
          onCancel={() => {
            setShowDeckSelector(false);
          }}
          title={`Select Deck vs ${selectedFriend.username || shortWallet(selectedFriend.wallet_address)}`}
        />
      )}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="rounded-2xl border p-5 space-y-5"
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-base)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--accent-primary)]" />
            <h2 className="font-display text-lg font-black tracking-widest uppercase text-[var(--text-primary)]">
              Social Hub
            </h2>
          </div>
          {overview?.limits?.friend_requests_per_day ? (
            <span className="text-[10px] font-tactical uppercase tracking-widest text-[var(--text-muted)]">
              Add limit: {overview.limits.friend_requests_per_day}/day
            </span>
          ) : null}
        </div>

        {blockingMatchId && (
          <div
            className="rounded-lg border px-4 py-3 space-y-2"
            style={{ borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.08)' }}
          >
            <p className="text-sm font-semibold text-amber-300">You have an ongoing match</p>
            <p className="text-xs text-[var(--text-muted)]">
              Quit that match to send a new challenge. You will forfeit and your opponent will win.
            </p>
            <div className="flex gap-2">
              <button
                disabled={quittingMatch}
                onClick={() => void handleQuitBlockingMatch()}
                className="flex-1 rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}
              >
                {quittingMatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                {quittingMatch ? 'Quitting...' : 'Quit that match'}
              </button>
              <button
                onClick={() => setBlockingMatchId(null)}
                className="px-3 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {feedback && (
          <div
            className="rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor:
                feedback.tone === 'error'
                  ? 'rgba(248,113,113,0.4)'
                  : feedback.tone === 'success'
                    ? 'rgba(52,211,153,0.4)'
                    : 'rgba(96,165,250,0.4)',
              background:
                feedback.tone === 'error'
                  ? 'rgba(248,113,113,0.12)'
                  : feedback.tone === 'success'
                    ? 'rgba(52,211,153,0.12)'
                    : 'rgba(96,165,250,0.12)',
              color: 'var(--text-primary)',
            }}
          >
            {feedback.text}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-tactical uppercase tracking-widest text-[var(--text-muted)]">Find Players</p>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search username or wallet"
              className="flex-1 rounded-lg border px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-base)]"
            />
            <button
              onClick={handleSearch}
              className="px-3 py-2 rounded-lg text-sm font-tactical font-semibold border border-[var(--border-base)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
              disabled={searching}
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((row) => {
                const key = row.wallet_address.toLowerCase();
                const relation = friendWalletSet.has(key)
                  ? 'friend'
                  : friendRequestMap.get(key) ?? null;
                const busy = busyKey === `request-${key}`;
                return (
                  <div
                    key={row.wallet_address}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                    style={{ borderColor: 'var(--border-base)', background: 'var(--bg-tertiary)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">
                        {row.username || shortWallet(row.wallet_address)}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">{shortWallet(row.wallet_address)}</p>
                    </div>
                    {relation === 'friend' ? (
                      <span className="text-[11px] text-emerald-400 font-semibold">Friend</span>
                    ) : relation === 'incoming' ? (
                      <span className="text-[11px] text-amber-300 font-semibold">Request Received</span>
                    ) : relation === 'outgoing' ? (
                      <span className="text-[11px] text-sky-300 font-semibold">Request Sent</span>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void runFriendAction(
                            { action: 'request', target_wallet: row.wallet_address },
                            `request-${key}`
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg text-xs font-tactical font-semibold flex items-center gap-1.5"
                        style={{ background: 'rgba(52,211,153,0.18)', color: '#34d399' }}
                      >
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-tactical uppercase tracking-widest text-[var(--text-muted)]">Incoming Requests</p>
            {incomingRequests.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No pending friend requests.</p>
            ) : (
              incomingRequests.map((row) => (
                <div key={row.request_id} className="rounded-lg border px-3 py-2 space-y-2" style={{ borderColor: 'var(--border-base)' }}>
                  <p className="text-sm text-[var(--text-primary)]">{row.username || shortWallet(row.wallet_address)}</p>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-emerald-300"
                      style={{ background: 'rgba(16,185,129,0.14)' }}
                      disabled={busyKey === `accept-${row.request_id}`}
                      onClick={() => void runFriendAction({ action: 'accept', request_id: row.request_id }, `accept-${row.request_id}`)}
                    >
                      Accept
                    </button>
                    <button
                      className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-rose-300"
                      style={{ background: 'rgba(244,63,94,0.14)' }}
                      disabled={busyKey === `decline-${row.request_id}`}
                      onClick={() => void runFriendAction({ action: 'decline', request_id: row.request_id }, `decline-${row.request_id}`)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}
            {outgoingRequests.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Outgoing</p>
                {outgoingRequests.map((row) => (
                  <div key={row.request_id} className="rounded-lg border px-3 py-2 flex items-center justify-between" style={{ borderColor: 'var(--border-base)' }}>
                    <span className="text-xs text-[var(--text-primary)]">{row.username || shortWallet(row.wallet_address)}</span>
                    <button
                      className="text-[11px] text-rose-300"
                      disabled={busyKey === `cancel-request-${row.request_id}`}
                      onClick={() => void runFriendAction({ action: 'cancel', request_id: row.request_id }, `cancel-request-${row.request_id}`)}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-tactical uppercase tracking-widest text-[var(--text-muted)]">Friends</p>
            {loading ? (
              <p className="text-xs text-[var(--text-muted)]">Loading friends...</p>
            ) : (overview?.friends || []).length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No friends yet.</p>
            ) : (
              (overview?.friends || []).map((friend) => (
                <div key={friend.wallet_address} className="rounded-lg border px-3 py-2 space-y-2" style={{ borderColor: 'var(--border-base)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">{friend.username || shortWallet(friend.wallet_address)}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{shortWallet(friend.wallet_address)}</p>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold"
                      style={{
                        background: friend.online ? 'rgba(16,185,129,0.18)' : 'rgba(148,163,184,0.15)',
                        color: friend.online ? '#34d399' : '#94a3b8',
                      }}
                    >
                      {friend.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 rounded-lg py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={{
                        background: friend.online ? 'rgba(96,165,250,0.18)' : 'rgba(71,85,105,0.25)',
                        color: friend.online ? '#93c5fd' : '#64748b',
                      }}
                      disabled={!friend.online || cardsLoading}
                      onClick={() => void openChallengeComposer(friend)}
                    >
                      {cardsLoading && selectedFriend?.wallet_address === friend.wallet_address ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Swords className="w-3 h-3" />
                      )}
                      Challenge
                    </button>
                    <button
                      className="rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-300"
                      style={{ background: 'rgba(244,63,94,0.14)' }}
                      disabled={busyKey === `remove-${friend.wallet_address}`}
                      onClick={() =>
                        void runFriendAction(
                          { action: 'remove', target_wallet: friend.wallet_address },
                          `remove-${friend.wallet_address}`
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedFriend && !showDeckSelector && (
          <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'rgba(96,165,250,0.35)', background: 'rgba(96,165,250,0.08)' }}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-primary)]">
                Challenge setup for <span className="font-semibold">{selectedFriend.username || shortWallet(selectedFriend.wallet_address)}</span>
              </p>
              <button className="text-xs text-[var(--text-muted)]" onClick={() => setSelectedFriend(null)}>
                Close
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Rounds</p>
                <div className="flex gap-1.5">
                  {[3, 5, 10].map((round) => (
                    <button
                      key={round}
                      className="flex-1 rounded-lg py-1.5 text-xs font-semibold"
                      style={{
                        background: challengeRounds === round ? 'rgba(52,211,153,0.16)' : 'var(--bg-tertiary)',
                        color: challengeRounds === round ? '#34d399' : 'var(--text-muted)',
                        border: `1px solid ${challengeRounds === round ? 'rgba(52,211,153,0.35)' : 'var(--border-base)'}`,
                      }}
                      onClick={() => setChallengeRounds(round as 3 | 5 | 10)}
                    >
                      {round}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Swap Rule</p>
                <div className="flex gap-1.5">
                  {(['Strict', 'Fun'] as const).map((rule) => (
                    <button
                      key={rule}
                      className="flex-1 rounded-lg py-1.5 text-xs font-semibold"
                      style={{
                        background: challengeRule === rule ? 'rgba(96,165,250,0.16)' : 'var(--bg-tertiary)',
                        color: challengeRule === rule ? '#93c5fd' : 'var(--text-muted)',
                        border: `1px solid ${challengeRule === rule ? 'rgba(96,165,250,0.35)' : 'var(--border-base)'}`,
                      }}
                      onClick={() => setChallengeRule(rule)}
                    >
                      {rule}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              className="w-full rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: 'rgba(96,165,250,0.2)', color: '#bfdbfe' }}
              disabled={cardsLoading || busyKey === `challenge-send-${selectedFriend.wallet_address}`}
              onClick={() => void openDeckSelector()}
            >
              {cardsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {cardsLoading ? 'Loading Deck...' : 'Choose Deck & Send'}
            </button>
          </div>
        )}

        {waitingChallenge && (
          <div
            className="rounded-xl border p-3 space-y-2"
            style={{ borderColor: 'rgba(52,211,153,0.35)', background: 'rgba(16,185,129,0.08)' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-primary)]">
                Waiting for {waitingChallenge.targetName} to accept
              </p>
              <span className="text-[11px] text-[var(--text-muted)]">{waitingSeconds}s</span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              If accepted, you will enter the arena automatically.
            </p>
            {waitingChallengeRow ? (
              <button
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-300"
                style={{ background: 'rgba(244,63,94,0.14)' }}
                disabled={busyKey === `cancel-challenge-${waitingChallengeRow.challenge_id}`}
                onClick={() =>
                  void runChallengeAction(
                    { action: 'cancel', challenge_id: waitingChallengeRow.challenge_id },
                    `cancel-challenge-${waitingChallengeRow.challenge_id}`,
                    'Challenge canceled.'
                  )
                }
              >
                Cancel Challenge
              </button>
            ) : (
              <p className="text-[11px] text-[var(--text-muted)]">Challenge queued. Syncing status...</p>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-tactical uppercase tracking-widest text-[var(--text-muted)]">Incoming Challenges</p>
            {incomingChallenges.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No incoming challenges.</p>
            ) : (
              incomingChallenges.map((challenge) => {
                const expired = new Date(challenge.expires_at).getTime() <= Date.now();
                return (
                  <div key={challenge.challenge_id} className="rounded-lg border px-3 py-2 space-y-2" style={{ borderColor: 'var(--border-base)' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[var(--text-primary)]">
                        {challenge.username || shortWallet(challenge.wallet_address)}
                      </p>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {challenge.total_rounds}R • {challenge.swap_rule}
                      </span>
                    </div>
                    {challenge.status === 'Accepted' ? (
                      <button
                        className="w-full rounded-lg py-1.5 text-xs font-semibold text-emerald-300"
                        style={{ background: 'rgba(16,185,129,0.14)' }}
                        onClick={() => router.push(`/match/${challenge.match_id}`)}
                      >
                        Enter Arena
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1"
                          style={{ background: 'rgba(16,185,129,0.14)' }}
                          disabled={expired || busyKey === `accept-challenge-${challenge.challenge_id}`}
                          onClick={() =>
                            void runChallengeAction(
                              { action: 'accept', challenge_id: challenge.challenge_id },
                              `accept-challenge-${challenge.challenge_id}`,
                              'Challenge accepted. Opening match...',
                              true
                            )
                          }
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Accept
                        </button>
                        <button
                          className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-rose-300 flex items-center justify-center gap-1"
                          style={{ background: 'rgba(244,63,94,0.14)' }}
                          disabled={busyKey === `decline-challenge-${challenge.challenge_id}`}
                          onClick={() =>
                            void runChallengeAction(
                              { action: 'decline', challenge_id: challenge.challenge_id },
                              `decline-challenge-${challenge.challenge_id}`,
                              'Challenge declined.'
                            )
                          }
                        >
                          <XCircle className="w-3 h-3" />
                          Decline
                        </button>
                      </div>
                    )}
                    {challenge.status === 'Pending' && (
                      <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {expired ? 'Expired' : `Expires ${new Date(challenge.expires_at).toLocaleTimeString()}`}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-tactical uppercase tracking-widest text-[var(--text-muted)]">Outgoing Challenges</p>
            {outgoingChallenges.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No outgoing challenges.</p>
            ) : (
              outgoingChallenges.map((challenge) => (
                <div key={challenge.challenge_id} className="rounded-lg border px-3 py-2 space-y-2" style={{ borderColor: 'var(--border-base)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[var(--text-primary)]">
                      {challenge.username || shortWallet(challenge.wallet_address)}
                    </p>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {challenge.total_rounds}R • {challenge.swap_rule}
                    </span>
                  </div>
                  {challenge.status === 'Accepted' ? (
                    <button
                      className="w-full rounded-lg py-1.5 text-xs font-semibold text-emerald-300"
                      style={{ background: 'rgba(16,185,129,0.14)' }}
                      onClick={() => router.push(`/match/${challenge.match_id}`)}
                    >
                      Enter Arena
                    </button>
                  ) : (
                    <button
                      className="w-full rounded-lg py-1.5 text-xs font-semibold text-rose-300"
                      style={{ background: 'rgba(244,63,94,0.14)' }}
                      disabled={busyKey === `cancel-challenge-${challenge.challenge_id}`}
                      onClick={() =>
                        void runChallengeAction(
                          { action: 'cancel', challenge_id: challenge.challenge_id },
                          `cancel-challenge-${challenge.challenge_id}`,
                          'Challenge canceled.'
                        )
                      }
                    >
                      Cancel Challenge
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </motion.section>
    </>
  );
}
