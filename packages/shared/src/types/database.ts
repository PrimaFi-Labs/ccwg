// Database types matching Supabase schema
// Shared package: @ccwg/shared/types/database

export type CardAsset = 'BTC' | 'ETH' | 'STRK' | 'SOL' | 'DOGE';
export type PlayerAction = 'Attack' | 'Defend' | 'Charge' | 'NoAction';
export type MatchMode = 'VsAI' | 'Ranked1v1' | 'WarZone' | 'Room' | 'Challenge';
export type MatchStatus = 'WaitingForOpponent' | 'InProgress' | 'PausedOracle' | 'Completed' | 'Cancelled';
export type StakeTier = 'Tier10' | 'Tier20' | 'Tier100';
export type EventStatus = 'Open' | 'InProgress' | 'Completed' | 'Cancelled';
export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
export type AdminRole = 'SuperAdmin' | 'Moderator' | 'Analyst';
export type RoomVisibility = 'Public' | 'Private';
export type RoomStatus = 'Open' | 'InProgress' | 'Completed' | 'Cancelled' | 'Expired';
export type RoomMemberStatus = 'Active' | 'Quit' | 'Eliminated' | 'Winner';
export type ChallengeSwapRule = 'Fun' | 'Strict';

export interface Player {
  wallet_address: string;
  username: string | null;
  wins: number;
  losses: number;
  total_xp: number;
  stark_points: number;
  strk_balance: string;
  created_at: string;
  updated_at: string;
}

export interface CardTemplate {
  template_id: number;
  asset: CardAsset;
  name: string;
  rarity: Rarity;
  base: number;
  attack_affinity: number;
  defense_affinity: number;
  charge_affinity: number;
  base_power?: number;
  base_defense?: number;
  base_focus?: number;
  volatility_sensitivity: number;
  ability_id: string;
  image_url: string | null;
  is_ai_card?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlayerCard {
  id: number;
  owner_wallet: string;
  template_id: number;
  level: number;
  merge_count: number;
  acquired_at: string;
  is_new?: boolean;
  template?: CardTemplate;
}

export interface BotCard {
  id: number;
  template_id: number;
  level: number;
  merge_count: number;
  created_at: string;
  updated_at: string;
  template?: CardTemplate;
}

export interface AbilityConfig {
  multiplier?: number;
  defense_penalty?: number;
  damage_multiplier?: number;
  attack_damage_multiplier?: number;
  trigger_round?: number;
  hide_momentum?: boolean;
  focus_penalty?: number;
  cloak_rounds?: number;
  duration_rounds?: number;
  block_once?: boolean;
  reflect_damage?: number;
  momentum_threshold?: number;
  disable_swap?: boolean;
  disable_charge?: boolean;
  ignore_negative_momentum?: boolean;
  focus_boost?: number;
}

export interface Ability {
  ability_id: string;
  name: string;
  description: string;
  trigger_type: 'conditional' | 'manual' | 'charge_triggered';
  effect_type: string;
  config: AbilityConfig;
  usage_limit: string;
  created_at: string;
  updated_at: string;
}

export interface Match {
  match_id: number;
  on_chain_id: number | null;
  event_context_id: number | null;
  room_context_id: number | null;
  room_context_player_wallet: string | null;
  player_1: string;
  player_2: string;
  bot_id?: number | null;
  mode: MatchMode;
  challenge_swap_rule?: ChallengeSwapRule | null;
  status: MatchStatus;
  stake_tier: StakeTier | null;
  total_stake: string;
  current_round: number;
  total_rounds: number;
  p1_rounds_won: number;
  p2_rounds_won: number;
  winner: string | null;
  transcript_hash: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface BotProfile {
  bot_id: number;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  preferred_assets: CardAsset[];
  aggression: number;
  defense: number;
  charge_bias: number;
  description: string | null;
  enabled: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface MatchPlayer {
  id: number;
  match_id: number;
  player_wallet: string;
  card_1_id: number | null;
  card_2_id: number | null;
  card_3_id: number | null;
  active_card_id: number | null;
  bot_card_1_id?: number | null;
  bot_card_2_id?: number | null;
  bot_card_3_id?: number | null;
  bot_active_card_id?: number | null;
  bot_charged_card_id?: number | null;
  swaps_used: number;
  charge_used: boolean;
  charge_armed: boolean;
  charged_card_id: number | null;
  charged_applies_round: number | null;
}

export interface MatchRound {
  id: number;
  match_id: number;
  round_number: number;
  btc_snapshot: string | null;
  eth_snapshot: string | null;
  strk_snapshot: string | null;
  sol_snapshot: string | null;
  doge_snapshot: string | null;
  p1_action: PlayerAction | null;
  p2_action: PlayerAction | null;
  p1_ability_triggered: boolean;
  p2_ability_triggered: boolean;
  winner: string | null;
  round_started_at: string | null;
  round_ended_at: string | null;
}

export interface MatchAction {
  id: number;
  match_id: number;
  round_number: number;
  player_wallet: string;
  action: PlayerAction;
  card_id: number | null;
  bot_card_id?: number | null;
  client_nonce: string;
  action_timestamp: string;
}

export interface MarketItem {
  item_id: number;
  name: string;
  description: string | null;
  item_type: 'single_card' | 'pack';
  price_strk: string;
  cards_granted: number;
  possible_cards: number[] | null;
  guaranteed_cards: number[] | null;
  card_weights: Record<string, number> | null;
  image_url: string | null;
  reveal_animation: boolean;
  is_active: boolean;
  per_wallet_limit?: number | null;
  purchases_count?: number;
  created_at: string;
}

export interface PurchaseHistory {
  purchase_id: number;
  player_wallet: string;
  item_id: number;
  tx_hash: string;
  amount_paid: string;
  cards_received: number[];
  purchased_at: string;
}

export interface CardDistributionConfig {
  guaranteed: number[];
  randomPool: number[];
  randomCount: number;
  weights?: Record<string, number>;
}

export interface Transaction {
  tx_id: number;
  tx_hash: string | null;
  tx_type: 'market_purchase' | 'match_settlement' | 'event_entry';
  player_wallet: string;
  amount: string;
  related_id: number | null;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
}

export interface GameEvent {
  event_id: number;
  on_chain_id: number | null;
  event_name: string;
  entry_fee: string;
  total_rounds: number;
  max_players: number;
  current_players: number;
  prize_pool: string;
  status: EventStatus;
  sp_reward: number;
  first_place_percent: number;
  second_place_percent: number;
  third_place_percent: number;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  settled_at: string | null;
}

export interface EventParticipant {
  id: number;
  event_id: number;
  player_wallet: string;
  card_1_id: number | null;
  card_2_id: number | null;
  card_3_id: number | null;
  war_points: number;
  total_wins: number;
  total_draws: number;
  total_losses: number;
  total_damage_done: number;
  total_damage_received: number;
  final_rank: number | null;
  prize_won: string;
  joined_at: string;
}

export interface Admin {
  wallet_address: string;
  role: AdminRole;
  created_at: string;
}

export interface AuditLog {
  log_id: number;
  admin_wallet: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  timestamp: string;
}

export type ReportReason = 'Cheating' | 'Stalling' | 'Harassment' | 'BugExploit' | 'Other';
export type ReportStatus = 'Open' | 'Reviewed' | 'Actioned' | 'Closed';
export type SanctionType = 'Suspension' | 'PermanentBan' | 'TournamentBan';
export type SanctionStatus = 'Active' | 'Expired' | 'Revoked';
export type PetitionStatus = 'None' | 'Pending' | 'Approved' | 'Rejected';

export interface PlayerReport {
  report_id: number;
  reporter_wallet: string;
  reported_wallet: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  admin_wallet: string | null;
  resolution_notes: string | null;
  related_sanction_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerSanction {
  sanction_id: number;
  player_wallet: string;
  sanction_type: SanctionType;
  reason: string;
  status: SanctionStatus;
  sp_penalty?: number;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  petition_text: string | null;
  petition_status: PetitionStatus;
  petition_created_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
}

export interface Announcement {
  announcement_id: number;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export interface Room {
  room_id: number;
  room_code: string;
  host_wallet: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  stake_fee: string;
  max_players: number;
  matches_per_player: number;
  current_players: number;
  total_rounds: number;
  timer_hours: number;
  prize_pool: string;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
  decay_at: string | null;
  settled_at: string | null;
  destroy_after: string | null;
  treasury_fee: string;
  winner_payout: string;
}

export interface RoomMember {
  id: number;
  room_id: number;
  player_wallet: string;
  status: RoomMemberStatus;
  card_1_id: number | null;
  card_2_id: number | null;
  card_3_id: number | null;
  fee_paid: string;
  prize_won: string;
  joined_at: string;
}

export interface RoomFixture {
  fixture_id: number;
  room_id: number;
  round_number: number;
  player_a: string;
  player_b: string | null;
  match_id: number | null;
  status: 'Scheduled' | 'InProgress' | 'Completed' | 'Bye';
  winner_wallet: string | null;
  created_at: string;
}

export interface RoomStanding {
  id: number;
  room_id: number;
  player_wallet: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
}

export type RoomDisputeStatus = 'Open' | 'Reviewed' | 'Resolved' | 'Closed';

export interface RoomDispute {
  dispute_id: number;
  room_code: string;
  room_id: number | null;
  player_wallet: string;
  message: string;
  status: RoomDisputeStatus;
  admin_wallet: string | null;
  admin_reply: string | null;
  report_id: number | null;
  created_at: string;
  updated_at: string;
}

export type InboxCategory = 'system' | 'dispute_reply' | 'room';

export interface PlayerInboxMessage {
  message_id: number;
  player_wallet: string;
  subject: string;
  body: string;
  category: InboxCategory;
  is_read: boolean;
  notification_key?: string | null;
  expires_at?: string;
  related_room_id: number | null;
  related_report_id: number | null;
  created_at: string;
}
