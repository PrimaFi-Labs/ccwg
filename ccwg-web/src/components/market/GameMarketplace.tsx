'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Layers, LayoutGrid } from 'lucide-react';
import { MarketItem } from './MarketItem';
import { PurchaseModal } from './PurchaseModal';
import type { MarketItem as MarketItemType } from '@/src/types/database';

interface GameMarketplaceProps {
  items: MarketItemType[];
  onPurchaseSuccess?: () => void;
}

const CATEGORIES = [
  { key: 'all',     label: 'All',     icon: LayoutGrid },
  { key: 'packs',   label: 'Packs',   icon: Package    },
  { key: 'singles', label: 'Singles', icon: Layers     },
] as const;

export function GameMarketplace({ items, onPurchaseSuccess }: GameMarketplaceProps) {
  const [selectedItem, setSelectedItem] = useState<MarketItemType | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | 'packs' | 'singles'>('all');

  const filtered = items.filter((item) => {
    if (activeCategory === 'packs')   return item.item_type === 'pack';
    if (activeCategory === 'singles') return item.item_type === 'single_card';
    return true;
  });

  const packsCount   = items.filter((i) => i.item_type === 'pack').length;
  const singlesCount = items.filter((i) => i.item_type === 'single_card').length;
  const freeCount    = items.filter((i) => !i.price_strk || i.price_strk === '0').length;
  const totalClaimed = items.reduce((s, i) => s + (i.purchases_count ?? 0), 0);

  const counts: Record<string, number> = {
    all:     items.length,
    packs:   packsCount,
    singles: singlesCount,
  };

  return (
    <div className="space-y-6">
      {/* ── Social proof banner ── */}
      <div
        className="rounded-xl border px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-3"
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-base)', backdropFilter: 'blur(12px)' }}
      >
        <StatBadge label="Offers"           value={items.length} />
        <div className="w-px h-6 hidden sm:block" style={{ background: 'var(--border-base)' }} />
        <StatBadge label="Packs"            value={packsCount}   accent="var(--accent-orange)" />
        <div className="w-px h-6 hidden sm:block" style={{ background: 'var(--border-base)' }} />
        <StatBadge label="Singles"          value={singlesCount} accent="var(--accent-primary)" />
        {freeCount > 0 && (
          <>
            <div className="w-px h-6 hidden sm:block" style={{ background: 'var(--border-base)' }} />
            <StatBadge label="Free to Claim" value={freeCount}  accent="#4ade80" />
          </>
        )}
        {totalClaimed > 0 && (
          <>
            <div className="w-px h-6 hidden sm:block" style={{ background: 'var(--border-base)' }} />
            <StatBadge label="Claimed"       value={totalClaimed} accent="var(--text-muted)" />
          </>
        )}
      </div>

      {/* ── Category tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(({ key, label, icon: Icon }) => {
          const active = activeCategory === key;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-tactical font-semibold tracking-wide transition-all"
              style={{
                background: active ? 'var(--accent-primary-dim)' : 'var(--bg-panel)',
                border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-base)'}`,
                color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                boxShadow: active ? '0 0 15px var(--hud-glow)' : 'none',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                style={{
                  background: active ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: active ? 'var(--bg-primary)' : 'var(--text-muted)',
                }}
              >
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Items grid ── */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-24 text-center text-[var(--text-muted)] text-sm"
          >
            No items in this category.
          </motion.div>
        ) : (
          <motion.div
            key={activeCategory}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          >
            {filtered.map((item, i) => (
              <motion.div
                key={item.item_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: i * 0.04 }}
              >
                <MarketItem item={item} onPurchase={setSelectedItem} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Modal */}
      {selectedItem && (
        <PurchaseModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSuccess={() => {
            onPurchaseSuccess?.();
          }}
        />
      )}
    </div>
  );
}

function StatBadge({ label, value, accent = 'var(--text-primary)' }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <p className="font-display font-black text-lg leading-none" style={{ color: accent }}>{value}</p>
      <p className="text-[10px] font-tactical font-bold tracking-widest uppercase text-[var(--text-muted)] mt-0.5">{label}</p>
    </div>
  );
}
