'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package } from 'lucide-react';
import { CardDisplay } from '../cards/CardDisplay';
import type { PlayerCard } from '@/src/types/database';

interface PackRevealAnimationProps {
  cards: PlayerCard[];
  onComplete: () => void;
  packName: string;
}

type Phase = 'intro' | 'reveal' | 'final';
type PackRevealMode = 'pack' | 'single';

const RARITY_BURST: Record<string, { color: string; glow: string; shadow: string }> = {
  Legendary: {
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.6)',
    shadow: '0 0 60px rgba(245,158,11,0.8), 0 0 120px rgba(245,158,11,0.4)',
  },
  Epic: {
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.6)',
    shadow: '0 0 60px rgba(168,85,247,0.8), 0 0 120px rgba(168,85,247,0.4)',
  },
  Rare: {
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.6)',
    shadow: '0 0 60px rgba(59,130,246,0.8), 0 0 120px rgba(59,130,246,0.4)',
  },
  Common: {
    color: '#94a3b8',
    glow: 'rgba(148,163,184,0.4)',
    shadow: '0 0 40px rgba(148,163,184,0.5)',
  },
};

function getRarityBurst(card: PlayerCard) {
  const rarity = card.template?.rarity ?? 'Common';
  return RARITY_BURST[rarity] ?? RARITY_BURST.Common;
}

// Pre-generate stable particle data so no Math.random() is called during render
const PARTICLE_DATA = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * 360;
  const distance = 80 + Math.random() * 120;
  const size = 3 + Math.random() * 5;
  const duration = 0.8 + Math.random() * 0.4;
  return {
    x: Math.cos((angle * Math.PI) / 180) * distance,
    y: Math.sin((angle * Math.PI) / 180) * distance,
    size,
    duration,
  };
});

function Particle({ color, index }: { color: string; index: number }) {
  const { x, y, size, duration } = PARTICLE_DATA[index];

  return (
    <motion.div
      initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      animate={{ opacity: 0, x, y, scale: 0 }}
      transition={{ duration, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        top: '50%',
        left: '50%',
        marginTop: -size / 2,
        marginLeft: -size / 2,
        filter: `blur(1px)`,
        pointerEvents: 'none',
      }}
    />
  );
}

export function PackRevealAnimation({ cards, onComplete, packName }: PackRevealAnimationProps) {
  const mode: PackRevealMode = cards.length === 1 ? 'single' : 'pack';
  const [phase, setPhase] = useState<Phase>(mode === 'single' ? 'reveal' : 'intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [particleKey, setParticleKey] = useState(0);
  const [burstActive, setBurstActive] = useState(false);
  const [burstColor, setBurstColor] = useState('#f59e0b');

  // Single-card: auto-trigger reveal burst on mount
  useEffect(() => {
    if (mode === 'single' && phase === 'reveal' && revealedCount === 0) {
      const burst = getRarityBurst(cards[0]);
      setBurstColor(burst.color);
      setBurstActive(true);
      setRevealedCount(1);
      const t = setTimeout(() => setBurstActive(false), 900);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-advance from pack intro after 1.2s
  useEffect(() => {
    if (phase === 'intro') {
      const t = setTimeout(() => setPhase('reveal'), 1200);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const gridCols = cards.length <= 3 ? 3 : cards.length <= 4 ? 4 : 5;

  function handleRevealClick() {
    if (phase === 'final') {
      onComplete();
      return;
    }

    // Clicking during intro immediately opens the pack
    if (phase === 'intro') {
      setPhase('reveal');
      return;
    }

    if (phase === 'reveal') {
      if (mode === 'single') {
        // Single card: clicking the CTA goes to final
        setPhase('final');
        return;
      }

      const burst = getRarityBurst(cards[currentIndex]);
      setBurstColor(burst.color);
      setBurstActive(true);
      setParticleKey(k => k + 1);
      setTimeout(() => setBurstActive(false), 900);

      const next = currentIndex + 1;
      setRevealedCount(next);

      if (next >= cards.length) {
        setPhase('final');
      } else {
        setCurrentIndex(next);
      }
    }
  }

  const spotlightCard = phase === 'reveal' ? cards[currentIndex] : null;
  const spotlightBurst = spotlightCard ? getRarityBurst(spotlightCard) : null;

  const ctaLabel =
    phase === 'final'
      ? '✦ Continue to Inventory'
      : mode === 'single'
      ? '✦ Add to Arsenal'
      : phase === 'intro'
      ? 'Open Pack'
      : `Reveal Card ${currentIndex + 1} of ${cards.length}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.96)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      {/* Ambient background pulse */}
      <AnimatePresence>
        {spotlightBurst && (
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at center, ${spotlightBurst.glow} 0%, transparent 60%)`,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Pack name */}
      <motion.p
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '1.5rem',
        }}
      >
        {packName}
      </motion.p>

      {/* Spotlight area */}
      <div
        style={{
          position: 'relative',
          width: 200,
          height: 280,
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={handleRevealClick}
      >
        {/* Particles */}
        <AnimatePresence>
          {burstActive && (
            <div key={particleKey} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {Array.from({ length: 24 }).map((_, i) => (
                <Particle key={i} color={burstColor} index={i} />
              ))}
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {phase === 'intro' && (
            <motion.div
              key="pack-intro"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [1, 1.05, 1], opacity: 1 }}
              exit={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                width: 160,
                height: 220,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                border: '2px solid var(--border-accent)',
                boxShadow: '0 0 40px var(--hud-glow)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <Package size={48} style={{ color: 'var(--text-accent)' }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                TAP TO OPEN
              </span>
            </motion.div>
          )}

          {phase === 'reveal' && spotlightCard && (
            <motion.div
              key={`reveal-${currentIndex}`}
              initial={{ rotateY: 90, opacity: 0, scale: 0.8 }}
              animate={{ rotateY: 0, opacity: 1, scale: 1 }}
              exit={{ scale: 0.6, opacity: 0, y: -30 }}
              transition={{ type: 'spring', damping: 18, stiffness: 260 }}
              style={{
                filter: spotlightBurst ? `drop-shadow(${spotlightBurst.shadow})` : undefined,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <CardDisplay card={spotlightCard} size="large" />

              {/* Rarity glow overlay */}
              {spotlightBurst && (
                <div
                  style={{
                    position: 'absolute',
                    inset: -2,
                    borderRadius: 12,
                    border: `2px solid ${spotlightBurst.color}`,
                    boxShadow: `inset 0 0 20px ${spotlightBurst.glow}`,
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* NEW badge if applicable */}
              {spotlightCard.is_new && (
                <div
                  style={{
                    position: 'absolute',
                    top: -10,
                    right: -10,
                    background: spotlightBurst?.color ?? 'var(--accent-primary)',
                    color: '#000',
                    fontSize: '0.625rem',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  NEW
                </div>
              )}
            </motion.div>
          )}

          {phase === 'final' && (
            <motion.div
              key="final-done"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 14, stiffness: 300 }}
              style={{
                width: 160,
                height: 220,
                borderRadius: 12,
                background: 'var(--bg-panel)',
                border: '2px solid var(--border-accent)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 0 40px var(--hud-glow)',
              }}
            >
              <motion.span
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                style={{ fontSize: '2rem' }}
              >
                🎁
              </motion.span>
              <span style={{ color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center' }}>
                {cards.length} {cards.length === 1 ? 'Card' : 'Cards'}
                <br />Claimed
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settled mini-grid — hidden for single-card during live spotlight */}
      {revealedCount > 0 && !(mode === 'single' && phase === 'reveal') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: '0.5rem',
            marginBottom: '2rem',
            maxWidth: 400,
          }}
        >
          {cards.slice(0, revealedCount).map((card, i) => (
            <motion.div
              key={card.id ?? i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: i === revealedCount - 1 && phase === 'reveal' ? 0.4 : 1 }}
              transition={{ type: 'spring', damping: 20, stiffness: 400 }}
            >
              <CardDisplay card={card} size="small" />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* CTA Button */}
      <motion.button
        onClick={handleRevealClick}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        style={{
          padding: '0.75rem 2.5rem',
          borderRadius: 8,
          background: phase === 'final' ? 'var(--accent-primary)' : 'var(--bg-panel)',
          color: phase === 'final' ? '#000' : 'var(--text-primary)',
          border: `1px solid ${phase === 'final' ? 'var(--accent-primary)' : 'var(--border-accent)'}`,
          fontWeight: 700,
          letterSpacing: '0.05em',
          fontSize: '0.875rem',
          cursor: 'pointer',
          boxShadow: phase === 'final' ? '0 0 20px var(--accent-primary-glow)' : '0 0 10px var(--hud-glow)',
          transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
        }}
      >
        {ctaLabel}
      </motion.button>
    </div>
  );
}
