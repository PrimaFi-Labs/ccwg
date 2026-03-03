// ccwg/ccwg-web/src/components/match/ActionPanel.tsx

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sword, Shield, Zap } from 'lucide-react';
import type { PlayerAction } from '@/src/types/database';

interface ActionPanelProps {
  onActionSelect: (action: PlayerAction) => void;
  chargeAvailable: boolean;
  disabled?: boolean;
  selectedAction?: PlayerAction | null;
}

export function ActionPanel({
  onActionSelect,
  chargeAvailable,
  disabled = false,
  selectedAction = null,
}: ActionPanelProps) {
  const [localAction, setLocalAction] = useState<PlayerAction | null>(selectedAction);

  const actions: Array<{
    type: PlayerAction;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
    gradient: string;
    glowColor: string;
    borderColor: string;
    available: boolean;
  }> = [
    {
      type: 'Attack',
      label: 'ATTACK',
      subtitle: 'Strike hard',
      icon: <Sword className="w-7 h-7" />,
      gradient: 'from-red-600/90 via-red-700/80 to-rose-900/70',
      glowColor: 'rgba(239,68,68,0.4)',
      borderColor: 'border-red-500/40',
      available: true,
    },
    {
      type: 'Defend',
      label: 'DEFEND',
      subtitle: 'Hold the line',
      icon: <Shield className="w-7 h-7" />,
      gradient: 'from-blue-600/90 via-blue-700/80 to-cyan-900/70',
      glowColor: 'rgba(59,130,246,0.4)',
      borderColor: 'border-blue-500/40',
      available: true,
    },
    {
      type: 'Charge',
      label: 'CHARGE',
      subtitle: 'Unleash ability',
      icon: <Zap className="w-7 h-7" />,
      gradient: 'from-yellow-500/90 via-amber-600/80 to-orange-800/70',
      glowColor: 'rgba(234,179,8,0.4)',
      borderColor: 'border-yellow-500/40',
      available: chargeAvailable,
    },
  ];

  const handleSelect = (action: PlayerAction) => {
    if (disabled) return;
    // Haptic on action lock
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 20, 60]);
    }
    setLocalAction(action);
    onActionSelect(action);
  };

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-2xl mx-auto">
      {actions.map((action) => {
        const isSelected = localAction === action.type;
        const isDisabled = !action.available || disabled;

        return (
          <motion.button
            key={action.type}
            whileHover={!isDisabled ? { scale: 1.06, y: -4 } : {}}
            whileTap={!isDisabled ? { scale: 0.92 } : {}}
            onClick={() => !isDisabled && handleSelect(action.type)}
            disabled={isDisabled}
            className={`
              relative overflow-hidden rounded-xl sm:rounded-2xl font-bold text-white transition-all
              p-4 sm:p-5 md:p-6
              border-2
              ${!isDisabled ? `bg-gradient-to-br ${action.gradient} ${action.borderColor}` : 'bg-[var(--bg-secondary)] border-[var(--border-base)] text-[var(--text-muted)]'}
              ${isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
            `}
            style={
              isSelected && !isDisabled
                ? { boxShadow: `0 0 30px ${action.glowColor}, 0 0 60px ${action.glowColor}` }
                : !isDisabled
                  ? { boxShadow: `0 4px 20px ${action.glowColor}` }
                  : undefined
            }
          >
            {/* Shimmer effect on hover */}
            {!isDisabled && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.6 }}
              />
            )}

            {/* Content */}
            <div className="flex flex-col items-center gap-1.5 relative z-10">
              <motion.div
                animate={isSelected ? { rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5 }}
              >
                {action.icon}
              </motion.div>
              <span className="text-sm sm:text-base tracking-wider">{action.label}</span>
              <span className="text-[10px] sm:text-xs opacity-60 font-normal hidden sm:block">{action.subtitle}</span>
            </div>

            {/* Selected ring */}
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  layoutId="selectedAction"
                  className="absolute inset-0 border-3 border-white rounded-xl sm:rounded-2xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                />
              )}
            </AnimatePresence>

            {/* Unavailable overlay */}
            {!action.available && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl sm:rounded-2xl">
                <span className="text-xs font-medium text-[var(--text-muted)]">Locked</span>
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
