//ccwg/ccwg-web/src/components/match/MomentumDisplay.tsx


'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MomentumDisplayProps {
  momentum: number; // Percentage as basis points (e.g., 250 = 2.5%)
  cardAsset: string;
  revealed?: boolean;
}

export function MomentumDisplay({
  momentum,
  cardAsset,
  revealed = false,
}: MomentumDisplayProps) {
  const momentumPercent = momentum / 100; // Convert to actual percentage
  const isPositive = momentumPercent > 0;
  const isNeutral = Math.abs(momentumPercent) < 0.1;

  const getColor = () => {
    if (isNeutral) return 'text-[var(--text-muted)]';
    return isPositive ? 'text-emerald-400' : 'text-red-400';
  };

  const getIcon = () => {
    if (isNeutral) return <Minus className="w-5 h-5" />;
    return isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />;
  };

  const getBorderColor = () => {
    if (isNeutral) return 'border-[var(--border-base)]';
    return isPositive ? 'border-emerald-500/30' : 'border-red-500/30';
  };

  if (!revealed) {
    return (
      <div className="rounded-lg p-4 text-center border border-[var(--border-base)]" style={{ background: 'var(--bg-secondary)' }}>
        <div className="w-16 h-8 bg-[var(--bg-tertiary)] animate-shimmer rounded mx-auto" />
        <p className="text-xs text-[var(--text-muted)] mt-2">Momentum Hidden</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`border-2 ${getBorderColor()} rounded-lg p-4`}
      style={{ background: 'var(--bg-secondary)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[var(--text-muted)]">{cardAsset}</span>
        <div className={`flex items-center gap-1 ${getColor()}`}>
          {getIcon()}
        </div>
      </div>

      <motion.div
        className={`text-2xl font-bold ${getColor()}`}
        animate={!isNeutral ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {isPositive ? '+' : ''}{momentumPercent.toFixed(2)}%
      </motion.div>

      {/* Visual indicator */}
      <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
        <motion.div
          initial={{ width: '50%' }}
          animate={{ 
            width: `${50 + (momentumPercent / 10) * 50}%`
          }}
          className={`h-full ${isPositive ? 'bg-emerald-500' : isNeutral ? 'bg-[var(--text-muted)]' : 'bg-red-500'}`}
          transition={{ type: 'spring', stiffness: 100 }}
        />
      </div>
    </motion.div>
  );
}