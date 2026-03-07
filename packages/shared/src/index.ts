// @ccwg/shared — barrel export

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  CardAsset,
  PlayerAction,
  MatchMode,
  MatchStatus,
  StakeTier,
  EventStatus,
  Rarity,
  AdminRole,
  RoomVisibility,
  RoomStatus,
  RoomMemberStatus,
  ChallengeSwapRule,
  Player,
  CardTemplate,
  PlayerCard,
  BotCard,
  AbilityConfig,
  Ability,
  Match,
  BotProfile,
  MatchPlayer,
  MatchRound,
  MatchAction,
  MarketItem,
  PurchaseHistory,
  CardDistributionConfig,
  Transaction,
  GameEvent,
  EventParticipant,
  Admin,
  AuditLog,
  ReportReason,
  ReportStatus,
  SanctionType,
  SanctionStatus,
  PetitionStatus,
  PlayerReport,
  PlayerSanction,
  Announcement,
  Room,
  RoomMember,
  RoomFixture,
  RoomStanding,
  RoomDisputeStatus,
  RoomDispute,
  InboxCategory,
  PlayerInboxMessage,
} from './types/database';

export type { Database } from './types/supabase';

export type {
  WSMessageType,
  WSMessage,
  JoinMatchMessage,
  SelectCardMessage,
  SubmitActionMessage,
  SwapCardMessage,
  UseChargeMessage,
  RoundStartMessage,
  OpponentCardSelectedMessage,
  OpponentActionLockedMessage,
  MomentumRevealMessage,
  RoundEndMessage,
  MatchEndMessage,
  ErrorMessage,
  BotMessageMessage,
  BotDialogueTrigger,
  AchievementUnlockedMessage,
} from './types/websocket';

export type {
  CombatStats,
  MomentumData,
  RoundResult,
  DeckSelection,
  AIDifficulty,
  AIConfig,
} from './types/game';

export type {
  CreateRankedMatchParams,
  DepositStakeParams,
  SettleMatchParams,
} from './types/contracts';

// ── Runtime values (re-exported) ───────────────────────────────────────────
export {
  WORLD_ADDRESS,
  MATCH_SYSTEM_ADDRESS,
  ESCROW_SYSTEM_ADDRESS,
  EVENT_SYSTEM_ADDRESS,
  ORACLE_SYSTEM_ADDRESS,
  ROOM_SYSTEM_ADDRESS,
  MARKET_SYSTEM_ADDRESS,
  STRK_TOKEN_ADDRESS,
} from './types/contracts';

export {
  STAKE_TIER_VALUES,
  ROUND_DURATION_MS,
  MATCH_ROUNDS,
  SWAP_LIMITS,
} from './types/game';

export { CombatEngine } from './lib/combat/engine';
export type { CardStats, CombatInput, AbilityEffect, CombatResult } from './lib/combat/engine';

export {
  getChallengeSwapLimit,
  CHALLENGE_EXPIRY_MS,
  CHALLENGE_MATCH_STALE_MS,
  FRIEND_REQUEST_DAILY_LIMIT,
  PRESENCE_WINDOW_MS,
  normalizeFriendPair,
  isPlayerOnline,
  touchPlayerPresence,
  expireStaleChallenges,
  isPlayerBusyInAnotherMatch,
} from './lib/social/shared';
export type { ChallengeSwapRule as ChallengeSwapRuleType } from './lib/social/shared';

export { normalizeEnv, getRpcUrl } from './lib/starknet/chain';
