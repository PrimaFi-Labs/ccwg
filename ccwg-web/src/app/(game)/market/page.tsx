'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from '@starknet-react/core';
import { GameMarketplace } from '@/src/components/market/GameMarketplace';
import { ConnectWallet } from '@/src/components/auth/ConnectWallet';
import type { MarketItem } from '@/src/types/database';
import { RefreshCw, Swords, Shield, Zap, Package } from 'lucide-react';
import { motion } from 'framer-motion';

const LOADING_TIPS = [
  'Packs reduce RNG variance — perfect for deck planning.',
  'A deck with one high-volatility finisher wins 30% more often.',
  'Singles are faster for targeted upgrades. Packs grow your roster.',
  'Legendary cards change the game. Every pack is a chance.',
  'Be strategic when buying a card.',
];

export default function MarketPage() {
  const { address, isConnected } = useAccount();
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [loading]);

  const fetchMarketItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/market/items?wallet_address=${address}`);
      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch market items:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected) {
      fetchMarketItems();
    }
  }, [isConnected, fetchMarketItems]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMarketItems();
  };

  if (!isConnected) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
        {/* Animated ambient orbs */}
        <div
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', animation: 'pulse 4s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--accent-orange) 0%, transparent 70%)', animation: 'pulse 5s ease-in-out infinite reverse' }}
        />

        {/* Floating feature pills */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[
            { icon: '⚔️', text: 'Legendary Cards', top: '18%', left: '8%', delay: '0s' },
            { icon: '🔥', text: 'Limited Packs', top: '25%', right: '10%', delay: '0.6s' },
            { icon: '⚡', text: 'Instant Delivery', bottom: '28%', left: '6%', delay: '1.2s' },
            { icon: '🛡️', text: 'Secure Trades', bottom: '22%', right: '8%', delay: '0.3s' },
          ].map(({ icon, text, delay, ...pos }) => (
            <motion.div
              key={text}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: parseFloat(delay), duration: 0.6 }}
              className="absolute hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-tactical font-semibold"
              style={{
                ...pos,
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-accent)',
                color: 'var(--text-secondary)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 0 20px var(--hud-glow)',
              }}
            >
              <span>{icon}</span>
              <span>{text}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 text-center max-w-lg w-full"
        >
          {/* Icon cluster */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--accent-primary-dim)', border: '1px solid var(--accent-primary)', boxShadow: '0 0 30px var(--hud-glow)' }}
            >
              <Shield className="w-7 h-7" style={{ color: 'var(--accent-primary)' }} />
            </motion.div>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.4)', boxShadow: '0 0 20px rgba(251,146,60,0.2)' }}
            >
              <Package className="w-5 h-5" style={{ color: 'var(--accent-orange)' }} />
            </motion.div>
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', boxShadow: '0 0 20px rgba(245,158,11,0.2)' }}
            >
              <Zap className="w-5 h-5" style={{ color: '#f59e0b' }} />
            </motion.div>
          </div>

          {/* Headline */}
          <h2
            className="font-display text-5xl md:text-6xl font-black tracking-widest uppercase mb-3"
            style={{ color: 'var(--text-primary)', letterSpacing: '0.12em' }}
          >
            The Armory
          </h2>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, var(--border-accent))' }} />
            <span className="text-xs font-tactical tracking-widest uppercase" style={{ color: 'var(--accent-primary)' }}>Awaits</span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, var(--border-accent))' }} />
          </div>
          <p className="text-sm leading-relaxed mb-8 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            Legendary packs, rare singles, guaranteed drops — your competitive edge is one transaction away.
          </p>

          {/* CTA card */}
          <div
            className="rounded-2xl p-6 mb-4"
            style={{
              background: 'var(--bg-panel)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid var(--border-accent)',
              boxShadow: '0 0 60px var(--hud-glow), 0 25px 50px rgba(0,0,0,0.4)',
            }}
          >
            <ConnectWallet />
            <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              Powered by Starknet · Non-custodial · Your keys, your cards
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg rounded-2xl border overflow-hidden"
          style={{
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(24px)',
            borderColor: 'var(--border-accent)',
            boxShadow: '0 0 50px var(--hud-glow)',
          }}
        >
          <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-orange), var(--accent-red))' }} />
          <div className="p-8">
            <div className="flex items-center gap-4 mb-8">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                style={{ border: '2px solid var(--accent-primary)', boxShadow: '0 0 20px var(--hud-glow)' }}
              >
                <div
                  className="w-8 h-8 rounded-full border-4 animate-spin"
                  style={{ borderColor: 'var(--accent-primary-dim)', borderTopColor: 'var(--accent-primary)' }}
                />
              </div>
              <div>
                <p className="font-display text-lg font-black tracking-widest uppercase text-[var(--text-primary)]">Loading Armory</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Syncing available offers…</p>
              </div>
            </div>
            <div
              className="rounded-xl border p-4"
              style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-base)' }}
            >
              <p className="text-[10px] font-tactical font-bold tracking-widest uppercase text-[var(--accent-primary)] mb-2">Tactical Tip</p>
              <p className="text-sm text-[var(--text-secondary)] min-h-[44px] transition-all">{LOADING_TIPS[tipIndex]}</p>
              <div className="mt-3 flex gap-1.5">
                {LOADING_TIPS.map((_, i) => (
                  <span
                    key={i}
                    className="h-1 rounded-full transition-all duration-500"
                    style={{
                      width: i === tipIndex ? '2rem' : '0.4rem',
                      background: i === tipIndex ? 'var(--accent-primary)' : 'var(--border-base)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-black tracking-widest uppercase text-[var(--text-primary)]">
              Armory
            </h1>
            <p className="text-xs font-tactical tracking-widest uppercase text-[var(--text-muted)] mt-0.5">
              Secure your arsenal
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-tactical font-semibold transition-all disabled:opacity-40"
              style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-base)',
                color: 'var(--text-muted)',
              }}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div
            className="text-center py-24 rounded-2xl border"
            style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-base)' }}
          >
            <Swords className="w-14 h-14 mx-auto mb-4 opacity-20" style={{ color: 'var(--text-muted)' }} />
            <h3 className="font-display text-xl font-black tracking-widest uppercase text-[var(--text-primary)] mb-2">
              Armory Empty
            </h3>
            <p className="text-[var(--text-muted)] text-sm mb-6">No offers available right now. Check back soon.</p>
            <button
              onClick={handleRefresh}
              className="px-6 py-2.5 rounded-lg font-tactical font-semibold text-sm transition-all"
              style={{ background: 'var(--accent-primary-dim)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}
            >
              Reload Offers
            </button>
          </div>
        ) : (
          <GameMarketplace items={items} onPurchaseSuccess={handleRefresh} />
        )}
      </div>
    </div>
  );
}
