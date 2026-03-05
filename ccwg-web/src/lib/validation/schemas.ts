//ccwg-web/src/lib/validation/schemas.ts

import { z } from 'zod';

// Starknet address regex (0x followed by 63-64 hex chars)
const addressRegex = /^0x[0-9a-fA-F]{63,64}$/;

// Common schemas
export const addressSchema = z.string().regex(addressRegex, 'Invalid Starknet address');

export const bigintStringSchema = z.string().regex(/^\d+$/, 'Must be a valid number string');

// Card schemas
export const createCardTemplateSchema = z.object({
  asset: z.enum(['BTC', 'ETH', 'STRK', 'SOL', 'DOGE']),
  name: z.string().min(1).max(50),
  rarity: z.enum(['Common', 'Rare', 'Epic', 'Legendary']),
  // NEW SIMPLIFIED STATS
  base: z.number().int().min(50).max(500),
  attack_affinity: z.number().int().min(-100).max(200),
  defense_affinity: z.number().int().min(-100).max(200),
  charge_affinity: z.number().int().min(0).max(100),
  // END NEW STATS
  volatility_sensitivity: z.number().min(0.1).max(2.0),
  ability_id: z.string().min(1),
  image_public_id: z.string().optional(), // Cloudinary public ID
  is_ai_card: z.boolean().optional(),
});

export const grantCardSchema = z.object({
  player_wallet: addressSchema,
  template_id: z.number().int().positive(),
  quantity: z.number().int().min(1).max(100).default(1),
});

// Match schemas
const totalRoundsSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? value : parsed;
    }
    return value;
  },
  z.number().int().refine((val) => [3, 5, 10].includes(val), {
    message: 'Invalid total_rounds; expected 3, 5, or 10',
  })
);

const aiTotalRoundsSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? value : parsed;
    }
    return value;
  },
  z.number().int().min(3).max(15, { message: 'Invalid total_rounds; expected 3-15' })
);

export const createRankedMatchSchema = z.object({
  opponent: addressSchema.optional(),
  deck: z.tuple([
    z.number().int().positive(),
    z.number().int().positive(),
    z.number().int().positive(),
  ]),
  event_id: z.number().int().positive().optional(),
  room_context_id: z.number().int().positive().optional(),
  from_event_context: z.boolean().optional(),
  stake_tier: z.enum(['Tier10', 'Tier20', 'Tier100']).optional(),
  total_rounds: totalRoundsSchema,
});

export const createAIMatchSchema = z.object({
  deck: z.tuple([
    z.number().int().positive(),
    z.number().int().positive(),
    z.number().int().positive(),
  ]),
  total_rounds: aiTotalRoundsSchema,
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'),
  bot_id: z.number().int().positive().optional(),
});

export const submitActionSchema = z.object({
  match_id: z.number().int().positive(),
  round_number: z.number().int().positive(),
  action: z.enum(['Attack', 'Defend', 'Charge']),
  client_nonce: z.string().min(1),
});

export const swapCardSchema = z.object({
  match_id: z.number().int().positive(),
  new_card_id: z.number().int().positive(),
  round_number: z.number().int().positive(),
});

export const setMatchDeckSchema = z.object({
  match_id: z.number().int().positive(),
  deck: z.tuple([
    z.number().int().positive(),
    z.number().int().positive(),
    z.number().int().positive(),
  ]),
});

// Event schemas
export const createEventSchema = z.object({
  event_name: z.string().min(1).max(100),
  entry_fee: bigintStringSchema,
  max_players: z.number().int().min(3).max(50),
  total_rounds: z.number().int().refine((val) => [3, 5, 10].includes(val), {
    message: 'Invalid total_rounds; expected 3, 5, or 10',
  }),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  sp_reward: z.number().int().min(0).default(0),
  first_place_percent: z.number().int().min(0).max(10000).default(6000),
  second_place_percent: z.number().int().min(0).max(10000).default(3000),
  third_place_percent: z.number().int().min(0).max(10000).default(1000),
}).refine(
  (data) => new Date(data.ends_at).getTime() > new Date(data.starts_at).getTime(),
  {
    message: 'ends_at must be later than starts_at',
    path: ['ends_at'],
  }
);

export const joinEventSchema = z.object({
  event_id: z.number().int().positive(),
});

// Room schemas
export const createRoomSchema = z.object({
  visibility: z.enum(['Public', 'Private']).default('Private'),
  stake_fee: bigintStringSchema,
  max_players: z.number().int().min(2).max(8),
  matches_per_player: z.number().int().min(2).max(30),
  total_rounds: z.number().int().refine((val) => [3, 5, 10].includes(val), {
    message: 'Invalid total_rounds; expected 3, 5, or 10',
  }),
  timer_hours: z.number().int().min(1).max(24),
});

export const joinRoomSchema = z.object({
  room_id: z.number().int().positive().optional(),
  room_code: z.string().min(4).max(12).optional(),
});

// Ability schemas
export const createAbilitySchema = z.object({
  ability_id: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  trigger_type: z.enum(['conditional', 'manual', 'charge_triggered']),
  effect_type: z.string().min(1),
  config: z.record(z.string(), z.any()),
  usage_limit: z.string().default('once_per_match'),
});

// Admin schemas
export const auditLogSchema = z.object({
  action: z.string().min(1),
  table_name: z.string().optional(),
  record_id: z.string().optional(),
  before_data: z.record(z.string(), z.any()).optional(),
  after_data: z.record(z.string(), z.any()).optional(),
});

export const createMarketItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  item_type: z.enum(['single_card', 'pack']),
  price_strk: z.string().regex(/^\d+$/, 'Must be a valid wei amount'),
  cards_granted: z.number().int().min(1).max(20),
  possible_cards: z.array(z.number().int()).min(1).optional(),
  guaranteed_cards: z.array(z.number().int()).optional().nullable(),
  card_weights: z.record(z.string(), z.number()).optional().nullable(),
  per_wallet_limit: z.number().int().min(1).max(999).optional().nullable(),
  duration_hours: z.number().int().min(1).optional().nullable(),
  image_public_id: z.string().optional(),
  reveal_animation: z.boolean().default(true),
}).refine(
  (data) => {
    // Single cards must have exactly 1 possible_card
    if (data.item_type === 'single_card') {
      return data.possible_cards?.length === 1 && data.cards_granted === 1;
    }
    // Packs must have at least 1 possible_card
    if (data.item_type === 'pack') {
      return (
        data.cards_granted === 3 &&
        data.possible_cards &&
        data.possible_cards.length >= data.cards_granted
      );
    }
    return true;
  },
  {
    message: 'Invalid card configuration for item type',
  }
).refine(
  (data) => {
    // If guaranteed_cards exist, they must be in possible_cards
    if (data.guaranteed_cards && data.possible_cards) {
      return data.guaranteed_cards.every(id => data.possible_cards!.includes(id));
    }
    return true;
  },
  {
    message: 'Guaranteed cards must be in possible_cards pool',
  }
).refine(
  (data) => {
    // Guaranteed cards cannot exceed cards_granted
    if (data.guaranteed_cards) {
      return data.guaranteed_cards.length <= data.cards_granted;
    }
    return true;
  },
  {
    message: 'Cannot have more guaranteed cards than cards_granted',
  }
);

export const purchaseItemSchema = z.object({
  item_id: z.number().int().positive(),
  tx_hash: z.string().min(1),
  player_wallet: z.string().regex(/^0x[a-fA-F0-9]{63,64}$/, 'Invalid Starknet address'),
});

export const updateMarketItemSchema = z.object({
  item_id: z.number().int().positive(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  price_strk: z.string().regex(/^\d+$/).optional(),
  is_active: z.boolean().optional(),
  guaranteed_cards: z.array(z.number().int()).optional().nullable(),
  card_weights: z.record(z.string(), z.number()).optional().nullable(),
  reveal_animation: z.boolean().optional(),
  per_wallet_limit: z.number().int().min(1).max(999).optional().nullable(),
});
