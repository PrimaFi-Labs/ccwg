//ccwg-web/src/types/websocket

import type { PlayerAction, CardAsset, PlayerCard, BotCard } from './database';

// WebSocket message types
export type WSMessageType =
  | 'connected'
  | 'join_match'
  | 'leave_match'
  | 'select_card'
  | 'submit_action'
  | 'swap_card'
  | 'use_charge'
  | 'round_start'
  | 'round_end'
  | 'match_end'
  | 'opponent_card_selected'
  | 'opponent_action_locked'
  | 'momentum_reveal'
  | 'bot_message'
  | 'achievement_unlocked'
  | 'error';

export type BotDialogueTrigger =
  | 'round_start'
  | 'round_won'
  | 'round_lost'
  | 'round_draw'
  | 'match_won'
  | 'match_lost'
  | 'match_draw';

export interface WSMessage {
  type: WSMessageType;
  payload: any;
  timestamp: number;
}

// Client -> Server messages
export interface JoinMatchMessage {
  type: 'join_match';
  payload: {
    match_id: number;
    player_wallet: string;
  };
}

export interface SelectCardMessage {
  type: 'select_card';
  payload: {
    match_id: number;
    player_wallet: string;
    card_id: number;
    round_number: number;
  };
}

export interface SubmitActionMessage {
  type: 'submit_action';
  payload: {
    match_id: number;
    player_wallet: string;
    action: PlayerAction;
    round_number: number;
    client_nonce: string;
  };
}

export interface SwapCardMessage {
  type: 'swap_card';
  payload: {
    match_id: number;
    player_wallet: string;
    new_card_id: number;
    round_number: number;
  };
}

export interface UseChargeMessage {
  type: 'use_charge';
  payload: {
    match_id: number;
    player_wallet: string;
    round_number: number;
  };
}

// Server -> Client messages
export interface RoundStartMessage {
  type: 'round_start';
  payload: {
    match_id: number;
    round_number: number;
    round_end_timestamp: number;
    first_mover_wallet?: string | null;
    btc_price: string;
    eth_price: string;
    strk_price: string;
    sol_price: string;
    doge_price: string;
    disable_charge?: boolean;
    disable_swap?: boolean;
    cloak_active?: boolean;
  };
}

export interface OpponentCardSelectedMessage {
  type: 'opponent_card_selected';
  payload: {
    match_id: number;
    round_number: number;
    opponent_wallet: string;
    card_asset: CardAsset;
    card?: PlayerCard | BotCard;
  };
}

export interface OpponentActionLockedMessage {
  type: 'opponent_action_locked';
  payload: {
    match_id: number;
    round_number: number;
    opponent_wallet: string;
    action: PlayerAction; // Core action only (Attack/Defend/Charge)
    your_new_deadline?: number; // Fresh epoch-ms deadline for the waiting player
  };
}

export interface MomentumRevealMessage {
  type: 'momentum_reveal';
  payload: {
    match_id: number;
    round_number: number;
    p1_momentum_percent: number;
    p2_momentum_percent: number;
    p1_base_price: string;
    p2_base_price: string;
    p1_snapshot_price: string;
    p2_snapshot_price: string;
    cloak_active?: boolean;
  };
}

export interface RoundEndMessage {
  type: 'round_end';
  payload: {
    match_id: number;
    round_number: number;
    winner: string | null;
    p1_damage: number;
    p2_damage: number;
    p1_rounds_won: number;
    p2_rounds_won: number;
    cloak_active?: boolean;
  };
}

export interface MatchEndMessage {
  type: 'match_end';
  payload: {
    match_id: number;
    winner: string | null;
    p1_rounds_won: number;
    p2_rounds_won: number;
    transcript_hash: string;
  };
}

export interface ErrorMessage {
  type: 'error';
  payload: {
    message: string;
    code?: string;
  };
}

export interface BotMessageMessage {
  type: 'bot_message';
  payload: {
    match_id: number;
    bot_wallet: string;
    trigger: BotDialogueTrigger;
    message: string;
  };
}

export interface AchievementUnlockedMessage {
  type: 'achievement_unlocked';
  payload: {
    match_id: number;
    player_wallet: string;
    achievement_key: string;
    title: string;
    description: string;
    category: string;
    tier: string;
    badge_icon: string;
    badge_color: string;
  };
}
