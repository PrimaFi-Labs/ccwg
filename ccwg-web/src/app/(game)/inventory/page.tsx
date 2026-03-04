'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from '@starknet-react/core';
import { useRouter } from 'next/navigation';
import { CardDisplay } from '@/src/components/cards/CardDisplay';
import { ConnectWallet } from '@/src/components/auth/ConnectWallet';
import { Crown, Swords, Shield, Zap, Layers, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerCard, Rarity } from '@/src/types/database';

const RARITY_ORDER: Rarity[] = ['Legendary', 'Epic', 'Rare', 'Common'];

const RARITY_STYLES: Record<Rarity, { label: string; color: string; glow: string; border: string }> = {
  Legendary: { label: 'Legendary', color: '#f59e0b', glow: 'rgba(245,158,11,0.4)', border: 'rgba(245,158,11,0.5)' },
  Epic:      { label: 'Epic',      color: '#a855f7', glow: 'rgba(168,85,247,0.4)', border: 'rgba(168,85,247,0.5)' },
  Rare:      { label: 'Rare',      color: 'var(--accent-primary)', glow: 'var(--accent-primary-glow)', border: 'var(--accent-primary)' },
  Common:    { label: 'Common',    color: 'var(--text-muted)',     glow: 'transparent',                border: 'var(--border-base)' },
};

const STAT_BARS = [
  { key: 'attack_affinity',  label: 'Attack',  icon: Swords, color: '#f87171' },
  { key: 'defense_affinity', label: 'Defense', icon: Shield, color: 'var(--accent-primary)' },
  { key: 'charge_affinity',  label: 'Charge',  icon: Zap,    color: '#a855f7' },
  { key: 'base',             label: 'Base',    icon: Layers, color: '#f59e0b' },
] as const;

function abilityLabel(id?: string) {
  if (!id) return 'Unknown';
  return id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatBar({ label, icon: Icon, value, max = 100, color }: {
  label: string;
  icon: React.ElementType;
  value: number;
  max?: number;
  color: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-tactical font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
          <Icon className="w-3 h-3" style={{ color }} />
          {label}
        </span>
        <span className="font-display font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-[3px] rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'All'>('All');
  const [flippedCardId, setFlippedCardId] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect below-xl viewport for mobile card flip behaviour
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1280);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleCardClick = (cardId: number) => {
    setSelectedCardId(cardId);
    if (isMobile) {
      setFlippedCardId((prev) => (prev === cardId ? null : cardId));
    }
  };

  useEffect(() => {
    if (!address) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/cards?wallet_address=${address}`);
        const data = await res.json();
        const loaded: PlayerCard[] = data.cards || [];
        setCards(loaded);
        setError(null);
        setSelectedCardId((prev) => prev ?? loaded[0]?.id ?? null);
      } catch {
        setError('Failed to load your cards. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [address]);

  const filtered = useMemo(
    () =>
      rarityFilter === 'All'
        ? cards
        : cards.filter((c) => c.template?.rarity === rarityFilter),
    [cards, rarityFilter]
  );

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) ?? null,
    [cards, selectedCardId]
  );

  const rarityStyle = selectedCard?.template?.rarity
    ? RARITY_STYLES[selectedCard.template.rarity]
    : null;

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
            <Package className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
          </motion.div>

          <h2 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Arsenal Locked</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
            Connect your wallet to view your cards
          </p>
          <ConnectWallet />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-screen-2xl mx-auto space-y-5">

        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-black tracking-widest uppercase text-[var(--text-primary)]">
              
            </h1>
            <p className="text-xs font-tactical text-[var(--text-muted)] tracking-widest uppercase mt-0.5">
              {cards.length} Card{cards.length !== 1 ? 's' : ''} · Your Collection
            </p>
          </div>

          {/* Rarity filter tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-base)' }}>
            {(['All', ...RARITY_ORDER] as const).map((r) => {
              const active = rarityFilter === r;
              const style = r !== 'All' ? RARITY_STYLES[r] : null;
              return (
                <button
                  key={r}
                  onClick={() => setRarityFilter(r)}
                  className="px-3 py-1.5 rounded text-xs font-tactical font-semibold tracking-wide uppercase transition-all duration-200"
                  style={{
                    background: active
                      ? style ? `${style.glow}` : 'var(--bg-tertiary)'
                      : 'transparent',
                    color: active
                      ? style ? style.color : 'var(--text-primary)'
                      : 'var(--text-muted)',
                    border: active ? `1px solid ${style ? style.border : 'var(--border-accent)'}` : '1px solid transparent',
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Main Body ─── */}
        {error ? (
          <div
            className="rounded-2xl border p-16 text-center"
            style={{ background: 'var(--bg-panel)', borderColor: 'rgba(248,113,113,0.3)' }}
          >
            <Package className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: '#f87171' }} />
            <p className="text-[#f87171] mb-5 text-sm">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); fetch(`/api/cards?wallet_address=${address}`).then(r => r.json()).then(d => { setCards(d.cards || []); }).catch(() => setError('Failed to load your cards. Please try again.')).finally(() => setLoading(false)); }}
              className="btn-primary px-6 py-2.5 text-sm"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-xl animate-pulse"
                style={{ background: 'var(--bg-panel)' }}
              />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div
            className="rounded-2xl border p-16 text-center"
            style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-base)' }}
          >
            <Crown className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <p className="text-[var(--text-muted)] mb-5 text-sm">Your arsenal is empty.</p>
            <button
              onClick={() => router.push('/market')}
              className="btn-primary px-6 py-2.5 text-sm"
            >
              Visit Market
            </button>
          </div>
        ) : (
          <div className="grid xl:grid-cols-[1fr_300px] gap-6 items-start">

            {/* Card Grid */}
            <motion.div
              layout
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((card) => {
                  const isFlipped = isMobile && flippedCardId === card.id;
                  const rs = card.template?.rarity ? RARITY_STYLES[card.template.rarity] : null;
                  return (
                    <motion.div
                      key={card.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div style={{ perspective: '1000px' }}>
                        <div
                          className="relative transition-transform duration-500"
                          style={{
                            transformStyle: 'preserve-3d',
                            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                          }}
                        >
                          {/* Front face */}
                          <div style={{ backfaceVisibility: 'hidden' }}>
                            <CardDisplay
                              card={card}
                              size="medium"
                              showStats={true}
                              selected={selectedCardId === card.id}
                              onClick={() => handleCardClick(card.id)}
                            />
                          </div>
                          {/* Back face — card stats (mobile only) */}
                          <div
                            className="absolute inset-0 rounded-xl overflow-hidden flex flex-col xl:hidden"
                            style={{
                              backfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg)',
                              background: 'var(--bg-panel)',
                              border: `1px solid ${rs?.border ?? 'var(--border-accent)'}`,
                              boxShadow: rs ? `0 0 20px ${rs.glow}` : '0 0 20px var(--hud-glow)',
                            }}
                            onClick={() => setFlippedCardId(null)}
                          >
                            <div className="h-1 w-full" style={{ background: rs?.color ?? 'var(--accent-primary)' }} />
                            <div className="flex-1 p-3 flex flex-col">
                              <div className="mb-2">
                                <h3 className="font-display text-sm font-bold text-[var(--text-primary)] truncate">
                                  {card.template?.name}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-[var(--text-muted)]">{card.template?.asset}</span>
                                  <span
                                    className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                                    style={{ color: rs?.color, background: rs?.glow ?? 'var(--bg-tertiary)' }}
                                  >
                                    {card.template?.rarity}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-2 flex-1">
                                {STAT_BARS.map(({ key, label, icon, color }) => (
                                  <StatBar
                                    key={key}
                                    label={label}
                                    icon={icon}
                                    value={(card.template as unknown as Record<string, number>)?.[key] ?? 0}
                                    color={color}
                                  />
                                ))}
                              </div>
                              <div className="mt-2 pt-2 border-t border-[var(--border-base)]">
                                <p className="text-[10px] text-[var(--text-secondary)] truncate">
                                  ⚡ {abilityLabel(card.template?.ability_id)}
                                </p>
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className="text-[10px] text-[var(--text-muted)]">Lv.{card.level}</span>
                                  <span className="text-[10px] text-[var(--text-muted)]">{card.merge_count} merges</span>
                                </div>
                                <p className="text-[9px] text-[var(--text-muted)] text-center mt-1.5 opacity-50">Tap to flip back</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {filtered.length === 0 && (
                <div className="col-span-full py-12 text-center text-[var(--text-muted)] text-sm">
                  No {rarityFilter} cards in your arsenal.
                </div>
              )}
            </motion.div>

            {/* Detail Panel — desktop only (mobile uses card flip) */}
            <div
              className="hidden xl:block xl:sticky xl:top-20 self-start rounded-2xl border overflow-hidden"
              style={{
                background: 'var(--bg-panel)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderColor: rarityStyle ? rarityStyle.border : 'var(--border-accent)',
                boxShadow: rarityStyle
                  ? `0 0 30px ${rarityStyle.glow}, inset 0 0 20px ${rarityStyle.glow}`
                  : '0 0 30px var(--hud-glow)',
              }}
            >
              <AnimatePresence mode="wait">
                {selectedCard?.template ? (
                  <motion.div
                    key={selectedCard.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 space-y-5"
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-tactical tracking-[0.3em] text-[var(--text-muted)] uppercase mb-1">
                          Card Intel
                        </p>
                        <h2 className="font-display text-xl font-black text-[var(--text-primary)] leading-tight">
                          {selectedCard.template.name}
                        </h2>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          Crypto: <span className="font-semibold text-[var(--text-secondary)]">{selectedCard.template.asset}</span>
                        </p>
                      </div>
                      <span
                        className="shrink-0 mt-1 px-2 py-1 rounded text-[10px] font-display font-bold tracking-wider uppercase"
                        style={{
                          color: rarityStyle?.color,
                          background: rarityStyle ? `${rarityStyle.glow}` : 'var(--bg-tertiary)',
                          border: `1px solid ${rarityStyle?.border ?? 'var(--border-base)'}`,
                        }}
                      >
                        {selectedCard.template.rarity}
                      </span>
                    </div>

                    {/* Divider */}
                    <div className="h-px" style={{ background: 'var(--border-base)' }} />

                    {/* Stat bars */}
                    <div className="space-y-3.5">
                      {STAT_BARS.map(({ key, label, icon, color }) => (
                        <StatBar
                          key={key}
                          label={label}
                          icon={icon}
                          value={(selectedCard.template as unknown as Record<string, number>)[key] ?? 0}
                          color={color}
                        />
                      ))}
                    </div>

                    {/* Divider */}
                    <div className="h-px" style={{ background: 'var(--border-base)' }} />

                    {/* Ability + meta */}
                    <div
                      className="rounded-xl p-3.5 space-y-1"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: `1px solid var(--border-base)`,
                      }}
                    >
                      <p className="text-[10px] font-tactical tracking-[0.25em] text-[var(--text-muted)] uppercase">
                        Charge Ability
                      </p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {abilityLabel(selectedCard.template.ability_id)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div
                        className="rounded-lg p-3 text-center"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-base)' }}
                      >
                        <p className="text-[10px] font-tactical text-[var(--text-muted)] uppercase tracking-wider mb-1">Level</p>
                        <p className="font-display text-lg font-bold text-[var(--text-primary)]">{selectedCard.level}</p>
                      </div>
                      <div
                        className="rounded-lg p-3 text-center"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-base)' }}
                      >
                        <p className="text-[10px] font-tactical text-[var(--text-muted)] uppercase tracking-wider mb-1">Merges</p>
                        <p className="font-display text-lg font-bold text-[var(--text-primary)]">{selectedCard.merge_count}</p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 text-center"
                  >
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm text-[var(--text-muted)]">Select a card to inspect</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
