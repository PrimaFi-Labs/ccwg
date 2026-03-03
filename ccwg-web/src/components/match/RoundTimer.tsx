//ccwg/ccwg-web/src/components/match/RoundTimer.tsx

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle } from 'lucide-react';

interface RoundTimerProps {
  roundEndTimestamp: number;
  paused?: boolean;
  label?: string;
  onTimeout?: () => void;
}

export function RoundTimer({ roundEndTimestamp, paused = false, label, onTimeout }: RoundTimerProps) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (roundEndTimestamp <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeLeft(0);
      return;
    }

    const update = () => {
      const remaining = Math.max(0, roundEndTimestamp - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0 && onTimeout) {
        onTimeout();
      }
    };

    update();
    if (paused) return;

    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [roundEndTimestamp, paused, onTimeout]);

  const seconds = Math.floor(timeLeft / 1000);
  const milliseconds = Math.floor((timeLeft % 1000) / 10);
  const percentage = (timeLeft / 60000) * 100;
  const isUrgent = percentage < 25;
  const isWarning = percentage < 50;

  const getBarColor = () => {
    if (isUrgent) return 'from-red-500 to-rose-600';
    if (isWarning) return 'from-yellow-500 to-amber-500';
    return 'from-emerald-500 to-green-500';
  };

  return (
    <motion.div
      className={`w-full max-w-md mx-auto rounded-xl p-3 border transition-colors ${
        isUrgent
          ? 'border-red-500/40'
          : 'border-[var(--border-base)]'
      }`}
      style={{ background: 'var(--bg-secondary)' }}
      animate={isUrgent && !paused ? { borderColor: ['rgba(239,68,68,0.4)', 'rgba(239,68,68,0.8)', 'rgba(239,68,68,0.4)'] } : {}}
      transition={isUrgent ? { duration: 0.8, repeat: Infinity } : {}}
    >
      {label && (
        <div className="text-center text-xs uppercase tracking-widest text-[var(--text-muted)] mb-2">
          {label}
        </div>
      )}
      {/* Timer display */}
      <div className="flex items-center justify-center gap-2.5 mb-2.5">
        <motion.div
          animate={isUrgent && !paused ? { scale: [1, 1.2, 1] } : {}}
          transition={isUrgent ? { duration: 0.5, repeat: Infinity } : {}}
        >
          {isUrgent ? (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          ) : (
            <Clock className="w-5 h-5 text-[var(--text-muted)]" />
          )}
        </motion.div>
        <motion.div
          className={`text-3xl font-mono font-bold tabular-nums ${
            isUrgent ? 'text-red-400' : 'text-[var(--text-primary)]'
          }`}
          animate={isUrgent && !paused ? { scale: [1, 1.05, 1] } : {}}
          transition={isUrgent ? { duration: 0.5, repeat: Infinity } : {}}
        >
          {seconds}.{milliseconds.toString().padStart(2, '0')}
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
        <motion.div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getBarColor()} rounded-full`}
          initial={{ width: '100%' }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.1 }}
        />
        {isUrgent && !paused && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-400/30 to-red-500/0"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        )}
      </div>

      {/* Warning text */}
      <AnimatePresence>
        {seconds < 10 && !paused && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            exit={{ opacity: 0 }}
            className="text-center text-red-400 text-xs mt-2 font-bold tracking-wide uppercase"
            transition={{ duration: 0.6, repeat: Infinity }}
          >
            Time running out!
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
