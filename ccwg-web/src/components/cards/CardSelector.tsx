// ccwg/ccwg-web/src/components/cards/CardSelector.tsx

'use client';

import { useEffect, useState } from 'react';
import { CardDisplay } from './CardDisplay';
import type { PlayerCard } from '@/src/types/database';
import { X, Swords, Shield, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CardSelectorProps {
  cards: PlayerCard[];
  maxSelection: number;
  onConfirm: (selectedCards: PlayerCard[]) => void;
  onCancel: () => void;
  title?: string;
}

export function CardSelector({
  cards,
  maxSelection,
  onConfirm,
  onCancel,
  title = 'Select Your Deck',
}: CardSelectorProps) {
  const [selected, setSelected] = useState<PlayerCard[]>([]);

  // Lock body scroll while open (prevents background scroll jank)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on ESC (expected modal behavior)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const handleSelect = (card: PlayerCard) => {
    const alreadySelected = selected.some((c) => c.id === card.id);

    if (alreadySelected) {
      setSelected(selected.filter((c) => c.id !== card.id));
    } else if (selected.length < maxSelection) {
      setSelected([...selected, card]);
      // Haptic feedback on card selection
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
  };

  const handleConfirm = () => {
    if (selected.length === maxSelection) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([50, 30, 80]);
      }
      onConfirm(selected);
    }
  };

  const isSelected = (card: PlayerCard) => selected.some((c) => c.id === card.id);
  const allSelected = selected.length === maxSelection;

  return (
    <AnimatePresence mode="wait">
      {/* Overlay */}
      <motion.div
        key="overlay"
        className="fixed inset-0 z-50 flex items-center justify-center sm:p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
      >
        {/* Panel */}
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
            mass: 0.9,
          }}
          className="flex flex-col w-full h-full max-h-screen overflow-y-auto border-0 sm:rounded-2xl sm:max-w-6xl sm:max-h-[95vh] sm:border sm:border-[var(--border-accent)]"
          style={{
            background: 'var(--bg-panel)',
            boxShadow: '0 0 60px rgba(var(--accent-primary-rgb, 168,85,247), 0.15), 0 25px 50px rgba(0,0,0,0.5)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 border-b border-[var(--border-base)] p-5 md:p-6"
            style={{ background: 'var(--bg-panel)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Swords className="w-7 h-7 text-[var(--accent-primary)]" />
                </motion.div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">{title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[var(--text-muted)] text-sm">
                      Select {maxSelection} cards
                    </p>
                    <span className="text-[var(--text-muted)]">•</span>
                    <div className="flex gap-1">
                      {Array.from({ length: maxSelection }).map((_, i) => (
                        <motion.div
                          key={i}
                          animate={i < selected.length ? { scale: [1, 1.3, 1] } : {}}
                          transition={{ duration: 0.3 }}
                          className={`w-2.5 h-2.5 rounded-full transition-colors ${
                            i < selected.length
                              ? 'bg-[var(--accent-primary)]'
                              : 'bg-[var(--border-base)]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-secondary)]"
                aria-label="Close"
              >
                <X className="w-6 h-6 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>

          {/* Cards grid */}
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
              {cards.map((card, index) => {
                const selectedNow = isSelected(card);
                const selectionIndex = selected.findIndex((c) => c.id === card.id);
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="relative"
                  >
                    <CardDisplay
                      card={card}
                      size="medium"
                      selected={selectedNow}
                      disabled={!selectedNow && selected.length >= maxSelection}
                      onClick={() => handleSelect(card)}
                    />
                    {/* Selection order badge */}
                    {selectedNow && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[var(--accent-primary)] flex items-center justify-center z-10 shadow-lg"
                      >
                        <span className="text-white text-xs font-bold">{selectionIndex + 1}</span>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {cards.length === 0 && (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                <p className="text-[var(--text-muted)]">No cards available</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="sticky bottom-0 border-t border-[var(--border-base)] p-4 md:p-6"
            style={{ background: 'var(--bg-panel)' }}
          >
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-5 py-3 rounded-xl text-[var(--text-primary)] font-medium transition-all border border-[var(--border-base)] hover:border-[var(--border-accent)] hover:bg-[var(--bg-secondary)]"
              >
                Retreat
              </button>
              <motion.button
                onClick={handleConfirm}
                disabled={!allSelected}
                whileHover={allSelected ? { scale: 1.02 } : {}}
                whileTap={allSelected ? { scale: 0.98 } : {}}
                className={`flex-1 px-5 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  allSelected
                    ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary,var(--accent-primary))] text-white shadow-lg shadow-[var(--accent-primary-glow)]'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed opacity-50'
                }`}
              >
                {allSelected && <CheckCircle2 className="w-5 h-5" />}
                Enter the Arena
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
