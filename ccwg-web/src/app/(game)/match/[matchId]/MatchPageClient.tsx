//ccwg-web/src/app/match/[matchId]/MatchPageClient.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccount } from '@starknet-react/core';
import { MatchArena } from '@/src/components/match/MatchArena';
import { CardSelector } from '@/src/components/cards/CardSelector';
import type { Match, PlayerCard, BotProfile } from '@/src/types/database';
import { Swords } from 'lucide-react';
import { motion } from 'framer-motion';

type MatchPageClientProps = {
  matchId: string;
};

export default function MatchPageClient({ matchId }: MatchPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const [match, setMatch] = useState<Match | null>(null);
  const [playerDeck, setPlayerDeck] = useState<PlayerCard[]>([]);
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [bot, setBot] = useState<BotProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeckSelector, setShowDeckSelector] = useState(false);
  const tournamentEventId = searchParams.get('eventId');

  const matchIdNumber = Number.parseInt(matchId, 10);

  useEffect(() => {
    if (!Number.isFinite(matchIdNumber)) {
      setLoading(false);
      setError('Match not found');
      return;
    }

    if (!isConnected) {
      router.push('/lobby');
      return;
    }

    const fetchMatchData = async () => {
      try {
        const matchResponse = await fetch(`/api/matches/${matchIdNumber}?wallet_address=${address}`);
        const matchData = await matchResponse.json();

        if (!matchData.match) {
          setError('Match not found');
          return;
        }

        setMatch(matchData.match);

        if (matchData.match?.mode === 'VsAI' && matchData.match?.bot_id) {
          const botResponse = await fetch(`/api/bots/${matchData.match.bot_id}`);
          if (botResponse.ok) {
            const botData = await botResponse.json();
            setBot(botData.bot || null);
          } else {
            setBot(null);
          }
        }

        const deckResponse = await fetch(`/api/matches/${matchIdNumber}/deck?wallet_address=${address}`);

        if (deckResponse.ok) {
          const deckData = await deckResponse.json();
          if (deckData.deck && deckData.deck.length === 3) {
            setPlayerDeck(deckData.deck);
          } else {
            // Deck incomplete (e.g. invitee of a challenge match) — show selector
            const cardsResponse = await fetch(`/api/cards?wallet_address=${address}`);
            const cardsData = await cardsResponse.json();
            setCards(cardsData.cards || []);
            setShowDeckSelector(true);
          }
        } else if (deckResponse.status === 404) {
          // No match_players row yet (challenge invitee) — show deck selector
          const cardsResponse = await fetch(`/api/cards?wallet_address=${address}`);
          const cardsData = await cardsResponse.json();
          setCards(cardsData.cards || []);
          setShowDeckSelector(true);
        } else {
          const deckData = await deckResponse.json().catch(() => ({}));
          console.error('Deck fetch failed:', deckData);
        }
      } catch (err) {
        console.error('Failed to fetch match data:', err);
        setError('Failed to load match');
      } finally {
        setLoading(false);
      }
    };

    fetchMatchData();
  }, [matchIdNumber, address, isConnected, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary, #0a0a0f)' }}>
        <div className="text-center relative">
          {/* Pulsing ring */}
          <motion.div
            className="absolute inset-0 -m-12 rounded-full border-2 border-[var(--accent-primary)] opacity-20"
            animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-0 -m-8 rounded-full border border-[var(--accent-primary)] opacity-10"
            animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0, 0.1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          />

          {/* Swords animation */}
          <motion.div
            className="relative z-10 mb-6"
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Swords className="w-16 h-16 text-[var(--accent-primary)] mx-auto" />
          </motion.div>

          <motion.p
            className="text-xl font-bold text-[var(--text-primary)]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Preparing the Arena
          </motion.p>
          <motion.p
            className="text-sm text-[var(--text-muted)] mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Loading match data...
          </motion.p>
        </div>
      </div>
    );
  }

  if (error || !match || !address) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary, #0a0a0f)' }}>
        <div className="text-center">
          <p className="text-red-400 mb-4 text-lg font-semibold">{error || 'Match not found'}</p>
          <button
            onClick={() => router.push('/lobby')}
            className="px-6 py-3 bg-[var(--accent-primary)] hover:opacity-90 text-white rounded-xl font-medium transition-all"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {showDeckSelector && (
        <CardSelector
          cards={cards}
          maxSelection={3}
          onConfirm={async (selectedCards) => {
            const deck = selectedCards.map((c) => c.id);
            const res = await fetch(`/api/matches/${match.match_id}/deck`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deck }),
            });
            const data = await res.json();
            if (data.error) {
              alert(data.error);
              return;
            }
            setPlayerDeck(selectedCards);
            setShowDeckSelector(false);
          }}
          onCancel={() => router.push('/lobby')}
          title="Select Your Deck (3 Cards)"
        />
      )}
      {!showDeckSelector && (
        <MatchArena
          match={match}
          playerWallet={address}
          playerDeck={playerDeck}
          opponentName={match.mode === 'VsAI' ? bot?.name || 'Bot' : 'Opponent'}
          opponentAvatarUrl={match.mode === 'VsAI' ? bot?.avatar_url : null}
          tournamentEventId={tournamentEventId}
        />
      )}
    </>
  );
}
