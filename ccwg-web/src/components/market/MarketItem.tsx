'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { OptimizedImage } from '@/src/components/ui/OptimizedImage';
import { ShoppingCart, Zap, Gift, Package, Layers, Flame, Lock } from 'lucide-react';
import type { MarketItem } from '@/src/types/database';
import { formatStrk } from '@/src/lib/cartridge/utils';

interface MarketItemProps {
  item: MarketItem;
  onPurchase: (item: MarketItem) => void;
  isPurchasing?: boolean;
}

export function MarketItem({ item, onPurchase, isPurchasing = false }: MarketItemProps) {
  const [hovered, setHovered] = useState(false);

  const isActive        = item.is_active && !isPurchasing;
  const isFree          = !item.price_strk || item.price_strk === '0';
  const isPack          = item.item_type === 'pack';
  const hasGuaranteed   = (item.guaranteed_cards?.length ?? 0) > 0;
  const hasLimit        = typeof item.per_wallet_limit === 'number' && item.per_wallet_limit > 0;
  const purchasesCount  = item.purchases_count ?? 0;
  const soldOut         = hasLimit && item.per_wallet_limit! <= purchasesCount;

  // Per-type accent
  const accent = isFree ? '#4ade80' : isPack ? 'var(--accent-orange)' : 'var(--accent-primary)';
  const accentGlow = isFree ? 'rgba(74,222,128,0.3)' : isPack ? 'rgba(251,146,60,0.25)' : 'var(--hud-glow)';

  // Psychological label
  const psychLabel: { text: string; color: string } | null =
    isFree                           ? { text: 'Free Claim',   color: '#4ade80' }
    : hasGuaranteed                   ? { text: '⚡ Guaranteed', color: '#f59e0b' }
    : isPack && purchasesCount > 5    ? { text: '🔥 Popular',   color: '#f87171' }
    : isPack                          ? { text: 'Best Value',   color: 'var(--accent-orange)' }
    : null;

  return (
    <motion.div
      whileHover={isActive && !soldOut ? { y: -6, scale: 1.02 } : {}}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative rounded-2xl overflow-hidden flex flex-col h-full"
      style={{
        background: 'var(--bg-panel)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${hovered && isActive ? accent : 'var(--border-base)'}`,
        boxShadow: hovered && isActive ? `0 0 30px ${accentGlow}, inset 0 0 20px ${accentGlow}` : 'none',
        opacity: (!isActive || soldOut) ? 0.55 : 1,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Accent top stripe */}
      <div className="h-0.5 w-full shrink-0" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

      {/* Image area */}
      <div className="relative aspect-[3/4] overflow-hidden shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
        {item.image_url ? (
          <OptimizedImage
            publicId={item.image_url}
            alt={item.name}
            transformation="CARD_DISPLAY"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isPack
              ? <Package className="w-16 h-16 opacity-20" style={{ color: accent }} />
              : <Layers  className="w-16 h-16 opacity-20" style={{ color: accent }} />}
          </div>
        )}

        {/* Shimmer overlay on hover */}
        {hovered && isActive && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ duration: 0.6 }}
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg] pointer-events-none"
          />
        )}

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2">
          <span
            className="px-2.5 py-1 rounded-full text-[10px] font-display font-bold tracking-wider uppercase backdrop-blur-sm"
            style={{ background: `${accent}25`, border: `1px solid ${accent}60`, color: accent }}
          >
            {isPack ? `${item.cards_granted}× Pack` : 'Single'}
          </span>
          {psychLabel && (
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-display font-bold tracking-wider uppercase backdrop-blur-sm"
              style={{ background: `${psychLabel.color}20`, border: `1px solid ${psychLabel.color}50`, color: psychLabel.color }}
            >
              {psychLabel.text}
            </span>
          )}
        </div>

        {/* Guaranteed banner */}
        {hasGuaranteed && (
          <div
            className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center gap-1.5"
            style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))', backdropFilter: 'blur(4px)' }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
            <span className="text-[11px] font-tactical font-bold" style={{ color: '#f59e0b' }}>
              {item.guaranteed_cards!.length} guaranteed card{item.guaranteed_cards!.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div>
          <h3 className="font-display font-black text-[var(--text-primary)] text-base leading-tight line-clamp-1">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Pool hint */}
        {isPack && item.possible_cards && (
          <p className="text-[10px] font-tactical text-[var(--text-muted)] leading-tight">
            {item.cards_granted} cards from a pool of {item.possible_cards.length}
          </p>
        )}

        {/* Limit progress */}
        {hasLimit && (
          <div>
            <div className="flex items-center justify-between text-[10px] font-tactical mb-1" style={{ color: 'var(--text-muted)' }}>
              <span>Per-wallet limit</span>
              <span>{purchasesCount} / {item.per_wallet_limit}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (purchasesCount / item.per_wallet_limit!) * 100)}%`,
                  background: soldOut ? '#f87171' : accent,
                }}
              />
            </div>
          </div>
        )}

        {/* Social proof */}
        {purchasesCount > 0 && (
          <p className="text-[10px] font-tactical text-[var(--text-muted)]">
            <Flame className="w-3 h-3 inline mr-1" style={{ color: '#f87171' }} />
            {purchasesCount} warrior{purchasesCount !== 1 ? 's' : ''} claimed this
          </p>
        )}

        {/* Price + CTA */}
        <div className="flex items-end justify-between gap-3 mt-auto pt-1">
          <div>
            <p className="text-[10px] font-tactical text-[var(--text-muted)] mb-0.5 uppercase tracking-wider">Price</p>
            {isFree ? (
              <p className="font-display text-2xl font-black" style={{ color: '#4ade80' }}>FREE</p>
            ) : (
              <p className="font-display text-2xl font-black" style={{ color: accent }}>
                {formatStrk(item.price_strk)}
                <span className="text-sm font-bold ml-1 opacity-70">STRK</span>
              </p>
            )}
          </div>

          <motion.button
            whileHover={isActive && !soldOut ? { scale: 1.06 } : {}}
            whileTap={isActive && !soldOut ? { scale: 0.94 } : {}}
            onClick={() => isActive && !soldOut && onPurchase(item)}
            disabled={!isActive || soldOut}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-display font-bold text-sm tracking-wide transition-all"
            style={
              soldOut
                ? { background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'not-allowed' }
                : isActive
                ? {
                    background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
                    color: isFree || isPack ? '#000' : 'var(--bg-primary)',
                    boxShadow: `0 0 20px ${accentGlow}`,
                  }
                : { background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'not-allowed' }
            }
          >
            {isPurchasing ? (
              <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : soldOut ? (
              <><Lock className="w-4 h-4" /> Limit Reached</>
            ) : isFree ? (
              <><Gift className="w-4 h-4" /> Claim</>
            ) : (
              <div className="dark:text-white font-sans"><ShoppingCart className="w-4 h-4 " /> Acquire</div>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
