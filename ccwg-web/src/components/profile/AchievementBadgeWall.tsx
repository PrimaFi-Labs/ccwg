'use client';

import { motion } from 'framer-motion';

export interface UnlockedAchievement {
  key: string;
  title: string;
  description: string;
  category: string;
  tier: string;
  badge_icon: string;
  badge_color: string;
  xp_reward: number;
  sp_reward: number;
  unlocked_at: string;
}

interface AchievementBadgeWallProps {
  achievements: UnlockedAchievement[];
}

const TIER_ORDER: Record<string, number> = { Platinum: 0, Gold: 1, Silver: 2, Bronze: 3 };

export function AchievementBadgeWall({ achievements }: AchievementBadgeWallProps) {
  if (achievements.length === 0) return null;

  const sorted = [...achievements].sort((a, b) => {
    const tierDiff = (TIER_ORDER[a.tier] ?? 4) - (TIER_ORDER[b.tier] ?? 4);
    if (tierDiff !== 0) return tierDiff;
    return new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime();
  });

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-accent)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">
        Warrior Badges
      </p>
      <div className="flex flex-wrap gap-2">
        {sorted.map((acv, i) => (
          <motion.div
            key={acv.key}
            className="group relative"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 cursor-default transition-transform group-hover:scale-110"
              style={{
                borderColor: acv.badge_color,
                background: `${acv.badge_color}18`,
                boxShadow: `0 0 8px ${acv.badge_color}44`,
              }}
            >
              {acv.badge_icon}
            </div>

            {/* Tooltip */}
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-xs text-center whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg border"
              style={{
                background: 'var(--bg-primary)',
                borderColor: `${acv.badge_color}55`,
                color: 'var(--text-primary)',
              }}
            >
              <span className="font-semibold">{acv.title}</span>
              <span
                className="block text-[10px] mt-0.5 font-bold uppercase tracking-wide"
                style={{ color: acv.badge_color }}
              >
                {acv.tier}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
