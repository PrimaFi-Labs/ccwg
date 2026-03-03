// Shared package: @ccwg/shared/types/game

import type { CardAsset, PlayerAction, StakeTier } from './database';

// Combat calculation types
export interface CombatStats {
  power: number;
  defense: number;
  focus: number;
  volatility_sensitivity: number;
}

export interface MomentumData {
  asset: CardAsset;
  base_price: number;
  snapshot_price: number;
  momentum_percent: number;
}

export interface RoundResult {
  round_number: number;
  p1_action: PlayerAction;
  p2_action: PlayerAction;
  p1_damage: number;
  p2_damage: number;
  winner: string;
  p1_momentum: MomentumData;
  p2_momentum: MomentumData;
  p1_ability_triggered: boolean;
  p2_ability_triggered: boolean;
}

export interface DeckSelection {
  card_1_id: number;
  card_2_id: number;
  card_3_id: number;
}

// AI difficulty
export type AIDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface AIConfig {
  difficulty: AIDifficulty;
  reaction_delay_ms: number;
  strategy_complexity: number;
  card_quality_boost: number;
}

// Stake tier values (in wei, 18 decimals)
export const STAKE_TIER_VALUES: Record<StakeTier, string> = {
  Tier10: '10000000000000000000',
  Tier20: '20000000000000000000',
  Tier100: '100000000000000000000',
};

// Round duration
export const ROUND_DURATION_MS = 60000;

// Match durations -> rounds
export const MATCH_ROUNDS: Record<number, number> = {
  3: 3,
  5: 5,
  10: 10,
};

// Swap limits
export const SWAP_LIMITS: Record<number, number> = {
  3: 2,
  5: 2,
  10: 999,
};
