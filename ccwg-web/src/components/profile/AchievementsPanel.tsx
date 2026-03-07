'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UnlockedAchievement } from './AchievementBadgeWall';

const CATEGORY_LABELS: Record<string, string> = {
  combat: '⚔️ Combat',
  strategist: '🧠 Strategist',
  rival: '🤖 Rival',
  ranked: '🏅 Ranked',
  collector: '🃏 Collector',
  grind: '🎮 Grind',
  social: '🤺 Social',
  legend: '🌟 Legend',
};

const CATEGORY_ORDER = ['combat', 'strategist', 'rival', 'ranked', 'collector', 'grind', 'social', 'legend'];

interface AchievementsPanelProps {
  walletAddress: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AchievementsPanel({ walletAddress }: AchievementsPanelProps) {
  const [achievements, setAchievements] = useState<UnlockedAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/player/achievements?wallet_address=${encodeURIComponent(walletAddress)}`)
      .then((r) => r.json())
      .then((json) => {
        setAchievements(json.achievements ?? []);
      })
      .catch(() => setAchievements([]))
      .finally(() => setLoading(false));
  }, [walletAddress]);

  const grouped = CATEGORY_ORDER.reduce<Record<string, UnlockedAchievement[]>>((acc, cat) => {
    const items = achievements.filter((a) => a.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div
      className="rounded-xl border p-4 sm:p-5"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-accent)' }}
    >
      <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">
        Achievements
      </h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
        </div>
      ) : achievements.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">🏆</p>
          <p className="text-sm text-[var(--text-muted)]">No achievements yet. Keep playing!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                {CATEGORY_LABELS[category] ?? category}
              </h3>
              <AnimatePresence>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((acv, i) => (
                    <motion.div
                      key={acv.key}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                      style={{
                        borderColor: `${acv.badge_color}44`,
                        background: `${acv.badge_color}08`,
                      }}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.04 }}
                    >
                      <div
                        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg border-2"
                        style={{
                          borderColor: acv.badge_color,
                          background: `${acv.badge_color}18`,
                        }}
                      >
                        {acv.badge_icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {acv.title}
                          </span>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border"
                            style={{ color: acv.badge_color, borderColor: `${acv.badge_color}55` }}
                          >
                            {acv.tier}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] leading-snug mt-0.5 line-clamp-2">
                          {acv.description}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]/60 mt-1">
                          {formatDate(acv.unlocked_at)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
