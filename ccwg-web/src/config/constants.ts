//ccwg/ccwg-web/src/config/constants.ts

// Round configuration
export const ROUND_DURATION_MS = 60000; // 60 seconds
export const ROUND_GRACE_PERIOD_MS = 2000; // 2 seconds grace for network latency

// Match configuration
export const MATCH_ROUNDS_OPTIONS = [3, 5, 10] as const;
export const SWAP_LIMITS: Record<number, number> = {
  3: 2,
  5: 2,
  10: 999, // Unlimited
};

// Stake tiers (in wei, 18 decimals)
export const STAKE_TIERS = {
  Tier10: '10000000000000000000',
  Tier20: '20000000000000000000',
  Tier100: '100000000000000000000',
} as const;

// XP & MMR
export const XP_REWARDS = {
  WIN: 100,
  LOSS: 25,
  TIMEOUT_PENALTY: -10,
};

export const STAKE_MULTIPLIERS = {
  Tier100: 5,
  Tier20: 3,
  Tier10: 1,
} as const;

// Commission
export const PLATFORM_COMMISSION_PERCENT = 5;

// Prize distribution (basis points)
export const WARZONE_PRIZE_SPLIT = {
  FIRST: 6000, // 60%
  SECOND: 3000, // 30%
  THIRD: 1000, // 10%
} as const;