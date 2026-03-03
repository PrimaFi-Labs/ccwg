'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Zap, CheckCircle2, Package, Layers } from 'lucide-react';
import { type Account } from 'starknet';
import { useAccount } from '@starknet-react/core';
import { useRouter } from 'next/navigation';
import { PackRevealAnimation } from './PackRevealAnimation';
import type { MarketItem, PlayerCard } from '@/src/types/database';
import { formatStrk } from '@/src/lib/cartridge/utils';
import { executePurchase, validatePurchase } from '@/src/lib/marketplace/purchaseHandler';

interface PurchaseModalProps {
  item: MarketItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

type PurchaseState = 'confirm' | 'processing' | 'revealing' | 'success' | 'error';

export function PurchaseModal({ item, onClose, onSuccess }: PurchaseModalProps) {
  const { account } = useAccount();
  const router = useRouter();
  const [state, setState] = useState<PurchaseState>('confirm');
  const [errorMessage, setErrorMessage] = useState('');
  const [purchasedCards, setPurchasedCards] = useState<PlayerCard[]>([]);

  if (!item) return null;

  const isFree       = !item.price_strk || item.price_strk === '0';
  const isPack       = item.item_type === 'pack';
  const hasLimit     = typeof item.per_wallet_limit === 'number' && item.per_wallet_limit > 0;
  const purchased    = item.purchases_count ?? 0;
  const accent       = isFree ? '#4ade80' : isPack ? 'var(--accent-orange)' : 'var(--accent-primary)';
  const accentGlow   = isFree ? 'rgba(74,222,128,0.25)' : isPack ? 'rgba(251,146,60,0.2)' : 'var(--hud-glow)';

  const handleConfirmPurchase = async () => {
    if (!account) {
      setErrorMessage('No wallet connected');
      setState('error');
      return;
    }
    const starknetAccount = account as unknown as Account;
    setState('processing');
    setErrorMessage('');

    try {
      console.log('[PurchaseModal] Starting purchase for item:', item.item_id, item.name, 'price:', item.price_strk);
      console.log('[PurchaseModal] Account type:', typeof starknetAccount, 'address:', starknetAccount.address);

      const validation = await validatePurchase(starknetAccount, item.price_strk);
      console.log('[PurchaseModal] Validation result:', validation);
      if (!validation.valid) {
        setErrorMessage(validation.error || 'Validation failed');
        setState('error');
        return;
      }

      const result = await executePurchase(starknetAccount, item.item_id, item.price_strk, item.name);
      console.log('[PurchaseModal] Purchase result:', result);
      if (!result.success) {
        setErrorMessage(result.error || 'Purchase failed');
        setState('error');
        return;
      }

      setPurchasedCards(result.cards || []);
      onSuccess?.();

      if (result.shouldReveal && result.cards && result.cards.length >= 1) {
        setState('revealing');
      } else {
        setState('success');
      }
    } catch (error: unknown) {
      console.error('[PurchaseModal] Unhandled error in handleConfirmPurchase:', error);
      const msg = (error as Error)?.message || 'Unexpected error';
      console.error('[PurchaseModal] Error message:', msg);
      setErrorMessage(msg);
      setState('error');
    }
  };

  const handleClose = () => {
    if (state === 'processing') return;
    onClose();
  };

  if (state === 'revealing') {
    return (
      <PackRevealAnimation
        cards={purchasedCards}
        onComplete={() => setState('success')}
        packName={item.name}
      />
    );
  }

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 22, stiffness: 320 }}
          className="max-w-md w-full rounded-2xl overflow-hidden"
          style={{
            background: 'var(--bg-secondary)',
            backdropFilter: 'blur(24px)',
            border: `1px solid ${state === 'error' ? '#f87171' : accent}`,
            boxShadow: `0 0 60px ${state === 'error' ? 'rgba(248,113,113,0.25)' : accentGlow}, 0 25px 50px rgba(0,0,0,0.5)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Accent bar */}
          <div
            className="h-1"
            style={{ background: state === 'error' ? '#f87171' : `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
          />

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-base)' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}
              >
                {isPack ? <Package className="w-4 h-4" style={{ color: accent }} /> : <Layers className="w-4 h-4" style={{ color: accent }} />}
              </div>
              <span className="font-display font-black text-[var(--text-primary)] tracking-wide text-sm uppercase">
                {state === 'success' ? 'Acquired' : state === 'error' ? 'Transaction Failed' : item.name}
              </span>
            </div>
            <button
              onClick={handleClose}
              disabled={state === 'processing'}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {/* ── CONFIRM ── */}
            {state === 'confirm' && (
              <div className="space-y-5">
                {item.description && (
                  <p className="text-sm text-[var(--text-muted)]">{item.description}</p>
                )}

                {/* Receipt */}
                <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--border-base)' }}>
                  <ReceiptRow label="Type" value={isPack ? `${item.cards_granted}× Card Pack` : 'Single Card'} />
                  <ReceiptRow
                    label="Price"
                    value={isFree ? 'FREE' : `${formatStrk(item.price_strk)} STRK`}
                    accent={accent}
                    large
                  />
                  {hasLimit && (
                    <ReceiptRow label="Limit" value={`${purchased} / ${item.per_wallet_limit} used`} />
                  )}
                  {(item.guaranteed_cards?.length ?? 0) > 0 && (
                    <div className="px-4 py-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 shrink-0" style={{ color: '#f59e0b' }} />
                      <span className="text-sm font-tactical font-semibold" style={{ color: '#f59e0b' }}>
                        {item.guaranteed_cards!.length} guaranteed card{item.guaranteed_cards!.length > 1 ? 's' : ''} included
                      </span>
                    </div>
                  )}
                </div>

                {/* Value proposition copy */}
                {isPack && (
                  <div
                    className="rounded-lg px-4 py-3 text-xs font-tactical leading-relaxed"
                    style={{ background: `${accent}08`, border: `1px solid ${accent}20`, color: accent }}
                  >
                    Packs grant {item.cards_granted} cards from a curated pool
                    {(item.guaranteed_cards?.length ?? 0) > 0 ? `, with ${item.guaranteed_cards!.length} guaranteed` : ''}.
                    Every card you own increases your deck variance advantage.
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3 rounded-xl text-sm font-tactical font-semibold transition-colors"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-base)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPurchase}
                    className="flex-1 py-3 rounded-xl text-sm font-display font-black tracking-wide transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${accent}cc, ${accent})`,
                      color: isFree ? '#000' : 'var(--bg-primary)',
                      boxShadow: `0 0 20px ${accentGlow}`,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 0 35px ${accentGlow}`)}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = `0 0 20px ${accentGlow}`)}
                  >
                    {isFree ? 'Claim Free' : `Pay ${formatStrk(item.price_strk)} STRK`}
                  </button>
                </div>
              </div>
            )}

            {/* ── PROCESSING ── */}
            {state === 'processing' && (
              <div className="py-10 flex flex-col items-center gap-5">
                {/* Orbiting rings */}
                <div className="relative w-20 h-20">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 rounded-full border-2 border-t-transparent"
                    style={{ borderColor: `${accent}40`, borderTopColor: accent }}
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-2 rounded-full border-2 border-r-transparent"
                    style={{ borderColor: `${accent}25`, borderRightColor: `${accent}90` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Zap className="w-6 h-6" style={{ color: accent }} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-display font-black text-lg text-[var(--text-primary)]">Processing</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    {isFree ? 'Claiming your cards…' : 'Confirm in your Cartridge wallet…'}
                  </p>
                </div>
              </div>
            )}

            {/* ── SUCCESS ── */}
            {state === 'success' && (
              <div className="space-y-5">
                <div className="py-6 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: `${accent}18`, boxShadow: `0 0 40px ${accentGlow}`, border: `1px solid ${accent}40` }}
                  >
                    <CheckCircle2 className="w-10 h-10" style={{ color: accent }} />
                  </motion.div>
                  <h3 className="font-display text-2xl font-black text-[var(--text-primary)] mb-1">
                    Arsenal Updated
                  </h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    {purchasedCards.length} card{purchasedCards.length !== 1 ? 's' : ''} added to your collection
                  </p>
                </div>
                <button
                  onClick={() => { onClose(); router.push('/inventory'); }}
                  className="w-full py-3 rounded-xl font-display font-black text-sm tracking-wide transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${accent}cc, ${accent})`,
                    color: isFree ? '#000' : 'var(--bg-primary)',
                    boxShadow: `0 0 20px ${accentGlow}`,
                  }}
                >
                  View in Inventory →
                </button>
              </div>
            )}

            {/* ── ERROR ── */}
            {state === 'error' && (
              <div className="space-y-5">
                <div className="py-6 text-center">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}
                  >
                    <AlertCircle className="w-10 h-10 text-[#f87171]" />
                  </div>
                  <h3 className="font-display text-xl font-black text-[var(--text-primary)] mb-1">Failed</h3>
                  <p className="text-sm text-[var(--text-muted)] max-w-xs mx-auto">{errorMessage}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3 rounded-xl text-sm font-tactical font-semibold"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-base)' }}
                  >
                    Close
                  </button>
                  <button
                    onClick={() => setState('confirm')}
                    className="flex-1 py-3 rounded-xl text-sm font-display font-black"
                    style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.4)' }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ReceiptRow({ label, value, accent, large }: { label: string; value: string; accent?: string; large?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs font-tactical text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
      <span
        className={`font-display font-black ${large ? 'text-xl' : 'text-sm'}`}
        style={{ color: accent ?? 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}
