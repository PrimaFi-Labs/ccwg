// ccwg-server/src/achievement-service.ts
// Achievement checking logic. Definitions are seeded in the DB via migration
// 033_achievements.sql. Each achievement has a `check` function here;
// adding a new achievement only requires one entry in the checks array +
// one INSERT in a new migration.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ccwg/shared';

export interface AchievementUnlock {
  key: string;
  title: string;
  description: string;
  category: string;
  tier: string;
  badge_icon: string;
  badge_color: string;
}

export interface MatchAchievementContext {
  matchId: number;
  playerWallet: string;
  mode: string;
  isWinner: boolean;
  /** Rounds this player won in the current match */
  playerRoundsWon: number;
  /** Rounds the opponent won in the current match */
  opponentRoundsWon: number;
  totalRounds: number;
  /** For VsAI matches — the resolved bot name ('E.V.E', 'Lit Trader', etc.) */
  botName?: string;
  /** Whether the player used a Charge action in this match */
  usedCharge: boolean;
  /** Whether the player used Defend as their first-round action */
  defendedRound1: boolean;
}

// ─── Achievement check definitions ─────────────────────────────────────────

type CheckFn = (
  ctx: MatchAchievementContext,
  supabase: SupabaseClient<Database>
) => Promise<boolean>;

const CHECKS: Record<string, CheckFn> = {

  // ── COMBAT ──────────────────────────────────────────────────────────────
  first_blood: async (ctx, sb) => {
    if (!ctx.isWinner) return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('status', 'Completed');
    return (count ?? 0) === 1; // this is the first win
  },

  dominant_victory: async (ctx) =>
    ctx.isWinner && ctx.opponentRoundsWon === 0 && ctx.playerRoundsWon >= 2,

  comeback_kid: async (ctx) =>
    ctx.isWinner && ctx.opponentRoundsWon >= 1,

  destroyer: async (ctx, sb) => {
    if (!ctx.isWinner) return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('status', 'Completed');
    return (count ?? 0) >= 50;
  },

  warlord: async (ctx, sb) => {
    if (!ctx.isWinner) return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('status', 'Completed');
    return (count ?? 0) >= 100;
  },

  legend_blade: async (ctx, sb) => {
    if (!ctx.isWinner) return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('status', 'Completed');
    return (count ?? 0) >= 500;
  },

  // ── STRATEGIST ───────────────────────────────────────────────────────────
  mind_reader: async (ctx) => ctx.isWinner && ctx.usedCharge,

  patient_warrior: async (ctx) => ctx.isWinner && ctx.defendedRound1,

  tactician: async (ctx, sb) => {
    if (!ctx.isWinner) return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('status', 'Completed');
    return (count ?? 0) >= 25;
  },

  grandmaster: async (ctx, sb) => {
    if (!ctx.isWinner) return false;
    const wallet = ctx.playerWallet;
    const [playedRes, winsRes] = await Promise.all([
      sb
        .from('matches')
        .select('match_id', { count: 'exact', head: true })
        .or(`player_1.eq.${wallet},player_2.eq.${wallet}`)
        .eq('status', 'Completed'),
      sb
        .from('matches')
        .select('match_id', { count: 'exact', head: true })
        .eq('winner', wallet)
        .eq('status', 'Completed'),
    ]);
    const played = playedRes.count ?? 0;
    const wins = winsRes.count ?? 0;
    return played >= 30 && wins / played >= 0.7;
  },

  // ── RIVAL ────────────────────────────────────────────────────────────────
  bot_slayer: async (ctx, sb) => {
    if (!ctx.isWinner || ctx.mode !== 'VsAI') return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('mode', 'VsAI')
      .eq('status', 'Completed');
    return (count ?? 0) === 1;
  },

  eve_nemesis: async (ctx) =>
    ctx.isWinner && ctx.mode === 'VsAI' && ctx.botName === 'E.V.E',

  market_crash: async (ctx) =>
    ctx.isWinner && ctx.mode === 'VsAI' && ctx.botName === 'Lit Trader',

  bot_veteran: async (ctx, sb) => {
    if (!ctx.isWinner || ctx.mode !== 'VsAI') return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('mode', 'VsAI')
      .eq('status', 'Completed');
    return (count ?? 0) >= 10;
  },

  bot_master: async (ctx, sb) => {
    if (!ctx.isWinner || ctx.mode !== 'VsAI') return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('mode', 'VsAI')
      .eq('status', 'Completed');
    return (count ?? 0) >= 50;
  },

  // ── RANKED ───────────────────────────────────────────────────────────────
  ranked_debut: async (ctx, sb) => {
    if (!ctx.isWinner || ctx.mode !== 'Ranked1v1') return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('mode', 'Ranked1v1')
      .eq('status', 'Completed');
    return (count ?? 0) === 1;
  },

  on_the_rise: async (ctx, sb) => {
    if (!ctx.isWinner || ctx.mode !== 'Ranked1v1') return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('mode', 'Ranked1v1')
      .eq('status', 'Completed');
    return (count ?? 0) >= 5;
  },

  ranked_warrior: async (ctx, sb) => {
    if (!ctx.isWinner || ctx.mode !== 'Ranked1v1') return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('mode', 'Ranked1v1')
      .eq('status', 'Completed');
    return (count ?? 0) >= 25;
  },

  elite_fighter: async (ctx, sb) => {
    if (!ctx.isWinner || ctx.mode !== 'Ranked1v1') return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('mode', 'Ranked1v1')
      .eq('status', 'Completed');
    return (count ?? 0) >= 50;
  },

  // ── GRIND ────────────────────────────────────────────────────────────────
  first_steps: async (ctx, sb) => {
    const wallet = ctx.playerWallet;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .or(`player_1.eq.${wallet},player_2.eq.${wallet}`)
      .eq('status', 'Completed');
    return (count ?? 0) === 1;
  },

  dedicated: async (ctx, sb) => {
    const wallet = ctx.playerWallet;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .or(`player_1.eq.${wallet},player_2.eq.${wallet}`)
      .eq('status', 'Completed');
    return (count ?? 0) >= 10;
  },

  veteran: async (ctx, sb) => {
    const wallet = ctx.playerWallet;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .or(`player_1.eq.${wallet},player_2.eq.${wallet}`)
      .eq('status', 'Completed');
    return (count ?? 0) >= 50;
  },

  centurion: async (ctx, sb) => {
    const wallet = ctx.playerWallet;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .or(`player_1.eq.${wallet},player_2.eq.${wallet}`)
      .eq('status', 'Completed');
    return (count ?? 0) >= 100;
  },

  marathon: async (ctx, sb) => {
    const wallet = ctx.playerWallet;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .or(`player_1.eq.${wallet},player_2.eq.${wallet}`)
      .eq('status', 'Completed');
    return (count ?? 0) >= 500;
  },

  hot_streak: async (ctx, sb) => {
    if (!ctx.isWinner) return false;
    return checkWinStreak(ctx.playerWallet, 3, sb);
  },

  on_fire: async (ctx, sb) => {
    if (!ctx.isWinner) return false;
    return checkWinStreak(ctx.playerWallet, 5, sb);
  },

  // ── COLLECTOR ───────────────────────────────────────────────────────────
  first_card: async (ctx, sb) => {
    const { count } = await sb
      .from('player_cards')
      .select('id', { count: 'exact', head: true })
      .eq('owner_wallet', ctx.playerWallet);
    return (count ?? 0) >= 1;
  },

  full_set: async (ctx, sb) => {
    const { data } = await sb
      .from('player_cards')
      .select('template:card_templates!inner(asset)')
      .eq('owner_wallet', ctx.playerWallet);
    if (!data) return false;
    const assets = new Set(data.map((r: any) => r.template?.asset));
    return ['BTC', 'ETH', 'STRK', 'SOL', 'DOGE'].every((a) => assets.has(a));
  },

  legendary_owner: async (ctx, sb) => {
    const { count } = await sb
      .from('player_cards')
      .select('id', { count: 'exact', head: true })
      .eq('owner_wallet', ctx.playerWallet)
      .eq('template:card_templates!inner(rarity)', 'Legendary' as any);
    return (count ?? 0) >= 1;
  },

  level_up: async (ctx, sb) => {
    const { count } = await sb
      .from('player_cards')
      .select('id', { count: 'exact', head: true })
      .eq('owner_wallet', ctx.playerWallet)
      .gte('level', 3);
    return (count ?? 0) >= 1;
  },

  max_power: async (ctx, sb) => {
    const { count } = await sb
      .from('player_cards')
      .select('id', { count: 'exact', head: true })
      .eq('owner_wallet', ctx.playerWallet)
      .gte('level', 5);
    return (count ?? 0) >= 1;
  },

  arsenal: async (ctx, sb) => {
    const { count } = await sb
      .from('player_cards')
      .select('id', { count: 'exact', head: true })
      .eq('owner_wallet', ctx.playerWallet);
    return (count ?? 0) >= 10;
  },

  // ── SOCIAL ───────────────────────────────────────────────────────────────
  challenger: async (ctx) => ctx.isWinner && ctx.mode === 'Challenge',

  room_warrior: async (ctx) => ctx.isWinner && ctx.mode === 'Room',

  tournament_fighter: async (_ctx, sb) => {
    // Checked separately (event join), but fall back to checking if player
    // has any event_participants row as a proxy.
    return false; // wired via the events API route instead
  },

  tournament_champion: async (_ctx) => false, // wired via events settlement

  // ── LEGEND ───────────────────────────────────────────────────────────────
  silver_warrior: async (ctx, sb) => {
    if (!ctx.isWinner) return false;
    const { count } = await sb
      .from('matches')
      .select('match_id', { count: 'exact', head: true })
      .eq('winner', ctx.playerWallet)
      .eq('status', 'Completed');
    return (count ?? 0) >= 10;
  },

  all_rounder: async (ctx, sb) => {
    if (!ctx.isWinner) return false;
    const wallet = ctx.playerWallet;
    const modes = ['VsAI', 'Ranked1v1', 'Challenge', 'Room'] as const;
    const results = await Promise.all(
      modes.map((m) =>
        sb
          .from('matches')
          .select('match_id', { count: 'exact', head: true })
          .eq('winner', wallet)
          .eq('mode', m)
          .eq('status', 'Completed')
      )
    );
    const wonModes = results.filter((r) => (r.count ?? 0) >= 1).length;
    return wonModes >= 4;
  },

  completionist: async (_ctx, sb) => {
    // Checked after awarding other achievements; see checkAndAward logic below
    return false; // handled specially in checkAndAward
  },

  unstoppable: async (ctx, sb) => {
    if (!ctx.isWinner) return false;
    return checkWinStreak(ctx.playerWallet, 10, sb);
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function checkWinStreak(
  wallet: string,
  required: number,
  sb: SupabaseClient<Database>
): Promise<boolean> {
  const { data } = await sb
    .from('matches')
    .select('winner')
    .or(`player_1.eq.${wallet},player_2.eq.${wallet}`)
    .eq('status', 'Completed')
    .order('ended_at', { ascending: false })
    .limit(required);

  if (!data || data.length < required) return false;
  return data.every((m) => m.winner === wallet);
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class AchievementService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * Check every unearned achievement for `playerWallet` given the current match
   * context. Inserts unlock records and returns the display data for each newly
   * unlocked achievement so the caller can broadcast them.
   */
  async checkMatchAchievements(
    ctx: MatchAchievementContext
  ): Promise<AchievementUnlock[]> {
    const { playerWallet } = ctx;
    try {
      // 1. Load all definitions
      const { data: defs } = await this.supabase
        .from('achievement_definitions')
        .select('key, title, description, category, tier, badge_icon, badge_color');
      if (!defs || defs.length === 0) return [];

      // 2. Load already-unlocked keys for this player
      const { data: existing } = await this.supabase
        .from('player_achievements')
        .select('achievement_key')
        .eq('player_wallet', playerWallet);
      const unlocked = new Set((existing ?? []).map((r) => r.achievement_key));

      // 3. Filter to defs that have a check function and aren't yet unlocked
      const candidates = defs.filter(
        (d) => !unlocked.has(d.key) && CHECKS[d.key] !== undefined
      );

      // 4. Run all checks concurrently
      const results = await Promise.allSettled(
        candidates.map(async (def) => {
          const passed = await CHECKS[def.key](ctx, this.supabase);
          return { def, passed };
        })
      );

      const newlyUnlocked: AchievementUnlock[] = [];
      const keysToInsert: string[] = [];

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.passed) {
          keysToInsert.push(result.value.def.key);
          newlyUnlocked.push({
            key: result.value.def.key,
            title: result.value.def.title,
            description: result.value.def.description,
            category: result.value.def.category,
            tier: result.value.def.tier,
            badge_icon: result.value.def.badge_icon,
            badge_color: result.value.def.badge_color,
          });
        }
      }

      // 5. Persist new unlocks
      if (keysToInsert.length > 0) {
        await this.supabase.from('player_achievements').insert(
          keysToInsert.map((key) => ({
            player_wallet: playerWallet,
            achievement_key: key,
          }))
        );

        console.log(
          `[ACHIEVEMENTS] ${playerWallet} unlocked: ${keysToInsert.join(', ')}`
        );
      }

      // 6. Check completionist (unlock 15 achievements) separately, now that
      //    we've recorded the new ones above.
      const totalNow = unlocked.size + keysToInsert.length;
      const completionistKey = 'completionist';
      if (
        !unlocked.has(completionistKey) &&
        !keysToInsert.includes(completionistKey) &&
        totalNow >= 15
      ) {
        const compDef = defs.find((d) => d.key === completionistKey);
        if (compDef) {
          await this.supabase.from('player_achievements').insert({
            player_wallet: playerWallet,
            achievement_key: completionistKey,
          });
          console.log(`[ACHIEVEMENTS] ${playerWallet} unlocked: completionist`);
          newlyUnlocked.push({
            key: compDef.key,
            title: compDef.title,
            description: compDef.description,
            category: compDef.category,
            tier: compDef.tier,
            badge_icon: compDef.badge_icon,
            badge_color: compDef.badge_color,
          });
        }
      }

      return newlyUnlocked;
    } catch (err) {
      // Non-critical: achievement failures must not break match flow
      console.error('[ACHIEVEMENTS] Check failed:', err);
      return [];
    }
  }

  /**
   * Award a specific achievement directly (e.g. from API routes).
   * Returns the unlock data if newly awarded, null if already owned or not found.
   */
  async awardAchievement(
    playerWallet: string,
    achievementKey: string
  ): Promise<AchievementUnlock | null> {
    try {
      const { data: def } = await this.supabase
        .from('achievement_definitions')
        .select('key, title, description, category, tier, badge_icon, badge_color')
        .eq('key', achievementKey)
        .maybeSingle();
      if (!def) return null;

      const { error } = await this.supabase.from('player_achievements').insert({
        player_wallet: playerWallet,
        achievement_key: achievementKey,
      });

      if (error) {
        // Duplicate = already owned
        if (error.code === '23505') return null;
        throw error;
      }

      console.log(`[ACHIEVEMENTS] ${playerWallet} unlocked: ${achievementKey}`);
      return {
        key: def.key,
        title: def.title,
        description: def.description,
        category: def.category,
        tier: def.tier,
        badge_icon: def.badge_icon,
        badge_color: def.badge_color,
      };
    } catch (err) {
      console.error('[ACHIEVEMENTS] awardAchievement failed:', err);
      return null;
    }
  }

  /**
   * Retroactively check all achievements for a player using their current DB
   * state (match history, card collection, streaks, etc.).  Can be called at
   * any time and is idempotent — already-owned achievements are skipped.
   *
   * Returns the list of newly awarded achievements for the response payload.
   */
  async backfillPlayerAchievements(playerWallet: string): Promise<AchievementUnlock[]> {
    try {
      // Build a synthetic "always-eligible" context — each CHECK that needs
      // real match context (isWinner, mode, …) is handled below via a
      // dedicated DB query instead.
      const ctx: MatchAchievementContext = {
        matchId: 0,
        playerWallet,
        mode: '__backfill__', // won't match any mode-specific check naturally
        isWinner: false,
        playerRoundsWon: 0,
        opponentRoundsWon: 0,
        totalRounds: 0,
        usedCharge: false,
        defendedRound1: false,
      };

      // Load all definitions
      const { data: defs } = await this.supabase
        .from('achievement_definitions')
        .select('key, title, description, category, tier, badge_icon, badge_color');
      if (!defs || defs.length === 0) return [];

      // Load already-unlocked keys
      const { data: existing } = await this.supabase
        .from('player_achievements')
        .select('achievement_key')
        .eq('player_wallet', playerWallet);
      const unlocked = new Set((existing ?? []).map((r) => r.achievement_key));

      // ── Backfill-specific evaluation ─────────────────────────────────────
      // For match-context checks we evaluate eligibility directly from the DB
      // rather than relying on the in-flight ctx.

      const wallet = playerWallet;

      const [
        winsRes,
        totalRes,
        aiWinsRes,
        rankedWinsRes,
        challengeWinsRes,
        roomWinsRes,
        cardsRes,
        cardAssetsRes,
        legRarityRes,
        level3Res,
        level5Res,
        lastMatchesRes,
      ] = await Promise.all([
        // total wins
        this.supabase
          .from('matches')
          .select('match_id', { count: 'exact', head: true })
          .eq('winner', wallet)
          .eq('status', 'Completed'),
        // total played
        this.supabase
          .from('matches')
          .select('match_id', { count: 'exact', head: true })
          .or(`player_1.eq.${wallet},player_2.eq.${wallet}`)
          .eq('status', 'Completed'),
        // VsAI wins
        this.supabase
          .from('matches')
          .select('match_id', { count: 'exact', head: true })
          .eq('winner', wallet)
          .eq('mode', 'VsAI')
          .eq('status', 'Completed'),
        // Ranked wins
        this.supabase
          .from('matches')
          .select('match_id', { count: 'exact', head: true })
          .eq('winner', wallet)
          .eq('mode', 'Ranked1v1')
          .eq('status', 'Completed'),
        // Challenge wins
        this.supabase
          .from('matches')
          .select('match_id', { count: 'exact', head: true })
          .eq('winner', wallet)
          .eq('mode', 'Challenge')
          .eq('status', 'Completed'),
        // Room wins
        this.supabase
          .from('matches')
          .select('match_id', { count: 'exact', head: true })
          .eq('winner', wallet)
          .eq('mode', 'Room')
          .eq('status', 'Completed'),
        // cards owned count
        this.supabase
          .from('player_cards')
          .select('id', { count: 'exact', head: true })
          .eq('owner_wallet', wallet),
        // card assets for full_set
        this.supabase
          .from('player_cards')
          .select('template:card_templates!inner(asset)')
          .eq('owner_wallet', wallet),
        // legendary cards
        this.supabase
          .from('player_cards')
          .select('id', { count: 'exact', head: true })
          .eq('owner_wallet', wallet)
          .eq('template:card_templates!inner(rarity)' as any, 'Legendary'),
        // level >= 3 cards
        this.supabase
          .from('player_cards')
          .select('id', { count: 'exact', head: true })
          .eq('owner_wallet', wallet)
          .gte('level', 3),
        // level >= 5 cards
        this.supabase
          .from('player_cards')
          .select('id', { count: 'exact', head: true })
          .eq('owner_wallet', wallet)
          .gte('level', 5),
        // last 10 matches for streak checks
        this.supabase
          .from('matches')
          .select('winner')
          .or(`player_1.eq.${wallet},player_2.eq.${wallet}`)
          .eq('status', 'Completed')
          .order('ended_at', { ascending: false })
          .limit(10),
      ]);

      const wins = winsRes.count ?? 0;
      const played = totalRes.count ?? 0;
      const aiWins = aiWinsRes.count ?? 0;
      const rankedWins = rankedWinsRes.count ?? 0;
      const challengeWins = challengeWinsRes.count ?? 0;
      const roomWins = roomWinsRes.count ?? 0;
      const cardsOwned = cardsRes.count ?? 0;
      const cardAssets = new Set(
        (cardAssetsRes.data ?? []).map((r: any) => r.template?.asset)
      );
      const hasLegendary = (legRarityRes.count ?? 0) >= 1;
      const hasLevel3 = (level3Res.count ?? 0) >= 1;
      const hasLevel5 = (level5Res.count ?? 0) >= 1;
      const lastMatches = lastMatchesRes.data ?? [];
      const streak = (n: number) =>
        lastMatches.length >= n && lastMatches.slice(0, n).every((m) => m.winner === wallet);

      // Also check mode diversity for all_rounder
      const wonAllModes =
        aiWins >= 1 && rankedWins >= 1 && challengeWins >= 1 && roomWins >= 1;

      // win-rate for grandmaster
      const winRate = played > 0 ? wins / played : 0;

      // dominant_victory / comeback_kid need per-match data — too expensive to
      // backfill accurately, so skip those context-specific checks here.
      const BACKFILL_CHECKS: Record<string, boolean> = {
        first_blood:       wins === 1,
        destroyer:         wins >= 50,
        warlord:           wins >= 100,
        legend_blade:      wins >= 500,
        tactician:         wins >= 25,
        grandmaster:       played >= 30 && winRate >= 0.7,
        bot_slayer:        aiWins === 1,
        bot_veteran:       aiWins >= 10,
        bot_master:        aiWins >= 50,
        ranked_debut:      rankedWins === 1,
        on_the_rise:       rankedWins >= 5,
        ranked_warrior:    rankedWins >= 25,
        elite_fighter:     rankedWins >= 50,
        first_steps:       played === 1,
        dedicated:         played >= 10,
        veteran:           played >= 50,
        centurion:         played >= 100,
        marathon:          played >= 500,
        hot_streak:        streak(3),
        on_fire:           streak(5),
        unstoppable:       streak(10),
        challenger:        challengeWins >= 1,
        room_warrior:      roomWins >= 1,
        silver_warrior:    wins >= 10,
        all_rounder:       wonAllModes,
        // collector
        first_card:        cardsOwned >= 1,
        full_set:          ['BTC', 'ETH', 'STRK', 'SOL', 'DOGE'].every((a) => cardAssets.has(a)),
        legendary_owner:   hasLegendary,
        level_up:          hasLevel3,
        max_power:         hasLevel5,
        arsenal:           cardsOwned >= 10,
      };

      const keysToInsert: string[] = [];
      const newlyUnlocked: AchievementUnlock[] = [];

      for (const def of defs) {
        if (unlocked.has(def.key)) continue;
        if (!(def.key in BACKFILL_CHECKS)) continue;
        if (!BACKFILL_CHECKS[def.key]) continue;

        keysToInsert.push(def.key);
        newlyUnlocked.push({
          key: def.key,
          title: def.title,
          description: def.description,
          category: def.category,
          tier: def.tier,
          badge_icon: def.badge_icon,
          badge_color: def.badge_color,
        });
      }

      if (keysToInsert.length > 0) {
        await this.supabase.from('player_achievements').insert(
          keysToInsert.map((key) => ({ player_wallet: playerWallet, achievement_key: key }))
        );
        console.log(`[ACHIEVEMENTS] backfill ${playerWallet}: ${keysToInsert.join(', ')}`);
      }

      // completionist check after inserting the batch
      const totalNow = unlocked.size + keysToInsert.length;
      const completionistKey = 'completionist';
      if (
        !unlocked.has(completionistKey) &&
        !keysToInsert.includes(completionistKey) &&
        totalNow >= 15
      ) {
        const compDef = defs.find((d) => d.key === completionistKey);
        if (compDef) {
          await this.supabase
            .from('player_achievements')
            .insert({ player_wallet: playerWallet, achievement_key: completionistKey });
          console.log(`[ACHIEVEMENTS] backfill ${playerWallet}: completionist`);
          newlyUnlocked.push({
            key: compDef.key,
            title: compDef.title,
            description: compDef.description,
            category: compDef.category,
            tier: compDef.tier,
            badge_icon: compDef.badge_icon,
            badge_color: compDef.badge_color,
          });
        }
      }

      return newlyUnlocked;
    } catch (err) {
      console.error('[ACHIEVEMENTS] backfill failed:', err);
      return [];
    }
  }
}
