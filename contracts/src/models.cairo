// ccwg/contracts/src/models.cairo

use starknet::ContractAddress;

// ============================================================================
// ENUMS
// ============================================================================

#[derive(Copy, Drop, Serde, DojoStore, Introspect, PartialEq, Default)]
pub enum CardAsset {
    #[default]
    BTC,
    ETH,
    STRK,
    SOL,
    DOGE,
}

#[derive(Copy, Drop, Serde, DojoStore, Introspect, PartialEq, Default)]
pub enum PlayerAction {
    #[default]
    Attack,
    Defend,
    Charge,
    UseAbility,
    NoAction,
}

#[derive(Copy, Drop, Serde, DojoStore, Introspect, PartialEq, Default)]
pub enum MatchMode {
    #[default]
    VsAI,
    Ranked1v1,
    WarZone,
}

#[derive(Copy, Drop, Serde, DojoStore, Introspect, PartialEq, Default)]
pub enum MatchStatus {
    #[default]
    WaitingForOpponent,
    InProgress,
    PausedOracle,
    Completed,
    Cancelled,
}

#[derive(Copy, Drop, Serde, DojoStore, Introspect, PartialEq, Default)]
pub enum StakeTier {
    #[default]
    Tier10,
    Tier20,
    Tier100,
}

#[derive(Copy, Drop, Serde, DojoStore, Introspect, PartialEq, Default)]
pub enum EventStatus {
    #[default]
    Open,
    InProgress,
    Completed,
    Cancelled,
}

#[derive(Copy, Drop, Serde, DojoStore, Introspect, PartialEq, Default)]
pub enum RoomStatus {
    #[default]
    Open,
    InProgress,
    Completed,
    Cancelled,
}

#[derive(Copy, Drop, Serde, DojoStore, Introspect, PartialEq, Default)]
pub enum MarketItemType {
    #[default]
    SingleCard,
    Pack,
}

// ============================================================================
// HELPER FUNCTIONS FOR ENUMS
// ============================================================================

pub impl StakeTierIntoU256 of Into<StakeTier, u256> {
    fn into(self: StakeTier) -> u256 {
        match self {
            StakeTier::Tier10 => 10_000_000_000_000_000_000,
            StakeTier::Tier20 => 20_000_000_000_000_000_000,
            StakeTier::Tier100 => 100_000_000_000_000_000_000,
        }
    }
}

pub impl CardAssetIntoPairId of Into<CardAsset, felt252> {
    fn into(self: CardAsset) -> felt252 {
        match self {
            CardAsset::BTC => 18669995996566340,
            CardAsset::ETH => 19514442401534788,
            CardAsset::STRK => 6004514686061859652,
            CardAsset::SOL => 23449611697214276,
            CardAsset::DOGE => 19227465571717956,
        }
    }
}

// ============================================================================
// CORE MODELS
// ============================================================================

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct Player {
    #[key]
    pub address: ContractAddress,
    pub wins: u32,
    pub losses: u32,
    pub total_xp: u64,
    pub strk_balance: u256,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct Card {
    #[key]
    pub owner: ContractAddress,
    #[key]
    pub card_id: u128,
    pub asset: CardAsset,
    pub level: u8,
    pub base_power: u32,
    pub base_defense: u32,
    pub base_focus: u32,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct Match {
    #[key]
    pub match_id: u128,
    pub player_1: ContractAddress,
    pub player_2: ContractAddress,
    pub mode: MatchMode,
    pub status: MatchStatus,
    pub stake_tier: StakeTier,
    pub total_stake: u256,
    pub p1_active_card_id: u128,
    pub p2_active_card_id: u128,
    pub current_round: u8,
    pub total_rounds: u8,
    pub p1_rounds_won: u8,
    pub p2_rounds_won: u8,
    pub winner: ContractAddress,
    pub created_at: u64,
    pub started_at: u64,
    pub ended_at: u64,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct Deck {
    #[key]
    pub player: ContractAddress,
    #[key]
    pub match_id: u128,
    pub card_1: u128,
    pub card_2: u128,
    pub card_3: u128,
    pub has_switched: bool,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct RoundSnapshot {
    #[key]
    pub match_id: u128,
    #[key]
    pub round_number: u8,
    pub btc_price: u128,
    pub eth_price: u128,
    pub strk_price: u128,
    pub sol_price: u128,
    pub doge_price: u128,
    pub snapshot_timestamp: u64,
    pub oracle_staleness: u64,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct Escrow {
    #[key]
    pub match_id: u128,
    pub total_amount: u256,
    pub p1_stake: u256,
    pub p2_stake: u256,
    pub is_locked: bool,
    pub is_settled: bool,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct AuthorizedServer {
    #[key]
    pub server_id: u8,
    pub server_address: ContractAddress,
    pub is_active: bool,
}

#[derive(Copy, Drop, Serde, Introspect)]
pub struct MatchResult {
    pub match_id: u128,
    pub winner: ContractAddress,
    pub p1_final_hp: u32,
    pub p2_final_hp: u32,
    pub p1_rounds_won: u8,
    pub p2_rounds_won: u8,
    pub transcript_hash: felt252,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct IdCounter {
    #[key]
    pub id: felt252,
    pub value: u128,
}

// ============================================================================
// EVENT MODELS - Renamed from Event to GameEvent to avoid conflict
// ============================================================================

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct GameEvent {
    #[key]
    pub event_id: u128,
    pub event_name: felt252,
    pub entry_fee: u256,
    pub max_players: u16,
    pub current_players: u16,
    pub prize_pool: u256,
    pub status: EventStatus,
    pub created_at: u64,
    pub starts_at: u64,
    pub ends_at: u64,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct EventParticipant {
    #[key]
    pub event_id: u128,
    #[key]
    pub player: ContractAddress,
    pub deck: (u128, u128, u128),
    pub final_rank: u16,
    pub prize_won: u256,
    pub joined_at: u64,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct EventPrizeDistribution {
    #[key]
    pub event_id: u128,
    pub first_place_percent: u16,
    pub second_place_percent: u16,
    pub third_place_percent: u16,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct EventParticipantsList {
    #[key]
    pub event_id: u128,
    pub participants_count: u16,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct EventParticipantIndex {
    #[key]
    pub event_id: u128,
    #[key]
    pub index: u16,
    pub player: ContractAddress,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct TreasuryConfig {
    #[key]
    pub config_id: u8,
    pub treasury_address: ContractAddress,
    pub accrued_fees: u256,
    pub updated_at: u64,
}

// ============================================================================
// ROOM MODELS
// ============================================================================

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct Room {
    #[key]
    pub room_id: u128,
    pub host: ContractAddress,
    pub stake_fee: u256,
    pub max_players: u16,
    pub current_players: u16,
    pub matches_per_player: u16,
    pub total_rounds: u8,
    pub prize_pool: u256,
    pub status: RoomStatus,
    pub created_at: u64,
    pub starts_at: u64,
    pub ends_at: u64,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct RoomMember {
    #[key]
    pub room_id: u128,
    #[key]
    pub player: ContractAddress,
    pub stake_paid: u256,
    pub is_active: bool,
    pub joined_at: u64,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct RoomParticipantsList {
    #[key]
    pub room_id: u128,
    pub participants_count: u16,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct RoomParticipantIndex {
    #[key]
    pub room_id: u128,
    #[key]
    pub index: u16,
    pub player: ContractAddress,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct RoomSettlement {
    #[key]
    pub room_id: u128,
    pub winner: ContractAddress,
    pub treasury_fee: u256,
    pub winner_payout: u256,
    pub settled_at: u64,
}

// ============================================================================
// MARKET MODELS
// ============================================================================

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct MarketItem {
    #[key]
    pub item_id: u128,
    pub name: felt252,
    pub item_type: MarketItemType,
    pub price_strk: u256,
    pub cards_granted: u8,
    pub per_wallet_limit: u16,
    pub is_active: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct MarketItemCardConfig {
    #[key]
    pub item_id: u128,
    #[key]
    pub index: u16,
    pub template_id: u128,
    pub guaranteed: bool,
    pub weight: u16,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct MarketInventory {
    #[key]
    pub player: ContractAddress,
    #[key]
    pub item_id: u128,
    pub quantity: u64,
    pub updated_at: u64,
}

#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct MarketPurchase {
    #[key]
    pub purchase_id: u128,
    pub item_id: u128,
    pub buyer: ContractAddress,
    pub amount_paid: u256,
    pub purchased_at: u64,
}
