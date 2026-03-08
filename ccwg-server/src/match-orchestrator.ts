// ccwg-web/server/match-orchestrator.ts

import WebSocket from 'ws';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AIEngine } from './ai-engine';
import { EVEAIEngine } from './eve-ai-engine';
import { LitTraderAIEngine } from './lit-trader-ai-engine';
import { SettlementService } from './settlement';
import { OracleSystemContractServer } from './oracle-system';

import type { Database } from '@ccwg/shared';
import type { Match, MatchRound, PlayerAction, CardAsset } from '@ccwg/shared';
import { CombatEngine, type AbilityEffect } from '@ccwg/shared';
import { getChallengeSwapLimit } from '@ccwg/shared';
import type {
  SelectCardMessage,
  SubmitActionMessage,
  SwapCardMessage,
  UseChargeMessage,
  RoundStartMessage,
  MomentumRevealMessage,
  RoundEndMessage,
  MatchEndMessage,
  BotMessageMessage,
  BotDialogueTrigger,
  AchievementUnlockedMessage,
} from '@ccwg/shared';
import { pickBotLine } from './bot-dialogue';
import { AchievementService, type MatchAchievementContext } from './achievement-service';

const ROUND_DURATION_MS = 60_000;
const SNAPSHOT_DISPLAY_DELAY_MS = 2500;

type MatchesRow = Database['public']['Tables']['matches']['Row'];
type MatchesUpdate = Database['public']['Tables']['matches']['Update'];
// MatchesRow may be generated from a Supabase snapshot that pre-dates the
// event_context_id migration.  We explicitly extend it here so every method
// in the event-update chain carries the correct type and the column is always
// accessed safely.
type MatchRow = MatchesRow & {
  event_context_id: number | null;
  room_context_id: number | null;
  room_context_player_wallet: string | null;
};

type MatchPlayersRow = Database['public']['Tables']['match_players']['Row'];
type MatchPlayersUpdate = Database['public']['Tables']['match_players']['Update'];

type MatchActionsRow = Database['public']['Tables']['match_actions']['Row'];
type MatchActionsInsert = Database['public']['Tables']['match_actions']['Insert'];

type MatchRoundsRow = Database['public']['Tables']['match_rounds']['Row'];
type MatchRoundsInsert = Database['public']['Tables']['match_rounds']['Insert'];
type MatchRoundsUpdate = Database['public']['Tables']['match_rounds']['Update'];

type OracleSnapshotsInsert = Database['public']['Tables']['oracle_snapshots']['Insert'];

type PlayerCardWithTemplate = {
  template: { asset: CardAsset } | null;
};

type PlayerCardWithFullTemplate = {
  id: number;
  owner_wallet: string;
  template_id: number;
  level: number;
  merge_count: number;
  acquired_at: string;
  template: {
    template_id: number;
    asset: CardAsset;
    name: string;
    rarity: string;
    base: number;
    attack_affinity: number;
    defense_affinity: number;
    charge_affinity: number;
    volatility_sensitivity: number;
    ability_id: string;
    image_url: string | null;
    created_at: string;
    updated_at: string;
  } | null;
};

type BotCardWithTemplate = {
  id: number;
  template_id: number;
  level: number;
  merge_count: number;
  created_at: string;
  updated_at: string;
  template: {
    template_id: number;
    asset: CardAsset;
    name: string;
    rarity: string;
    base: number;
    attack_affinity: number;
    defense_affinity: number;
    charge_affinity: number;
    volatility_sensitivity: number;
    ability_id: string;
    image_url: string | null;
    created_at: string;
    updated_at: string;
  } | null;
};

interface ActiveMatch {
  matchId: number;
  players: Map<string, WebSocket>;
  roundTimer: NodeJS.Timeout | null;
  roundEndTimestamp: number;
  currentRoundActions: Map<string, PlayerAction>;
  currentRoundCards: Map<string, CardAsset>;
  firstMoverWallet: string;
  cloakUntilRoundByWallet: Map<string, number>;
  disableChargeUntilRoundByWallet: Map<string, number>;
  disableSwapUntilRoundByWallet: Map<string, number>;
  /** Whether on-chain escrow was successfully locked for this match. */
  escrowLocked: boolean;
  /**
   * Stored after each round resolves so the NEXT round's dialogue can
   * reference what just happened ("I wasn't surprised I won that").
   */
  lastRoundBotTrigger: BotDialogueTrigger | null;
  basePrices?: {
    btc: string;
    eth: string;
    strk: string;
    sol: string;
    doge: string;
  };
}

type AbilityRow = {
  ability_id: string;
  trigger_type: string | null;
  effect_type: string;
  config: Record<string, unknown> | null;
};

type TemplateStats = {
  template_id: number;
  asset: CardAsset;
  base: number;
  attack_affinity: number;
  defense_affinity: number;
  charge_affinity: number;
  volatility_sensitivity: number;
  ability_id: string;
};

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function safeSend(ws: WebSocket, message: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ ...asObject(message), timestamp: Date.now() }));
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return { value };
}

/**
 * Derives a Cloudinary image URL directly from the card asset name.
 * Used as a fallback when the full template join fails, so the client
 * always has at minimum an image to display.
 */
function getImageUrlForAsset(asset: CardAsset): string {
  return `ccwg/cards/${asset.toLowerCase()}`;
}

export class MatchOrchestrator {
  private supabase: SupabaseClient<Database>;
  private aiEngine: AIEngine;
  private eveEngine: EVEAIEngine;
  private litTraderEngine: LitTraderAIEngine;
  private settlementService: SettlementService;
  private achievementService: AchievementService;
  private activeMatches: Map<number, ActiveMatch>;
  private oracleSystem: OracleSystemContractServer;
  private combatEngine: CombatEngine;

  constructor() {
    const SUPABASE_URL = assertEnv('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = assertEnv('SUPABASE_SERVICE_ROLE_KEY');

    this.supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    this.aiEngine = new AIEngine(this.supabase, async (args) => {
      await this.handleAIAction(args.matchId, args.roundNumber, args.playerWallet, args.action, args.clientNonce);
    });
    this.eveEngine = new EVEAIEngine(this.supabase, async (args) => {
      await this.handleAIAction(args.matchId, args.roundNumber, args.playerWallet, args.action, args.clientNonce);
    });
    this.litTraderEngine = new LitTraderAIEngine(this.supabase, async (args) => {
      await this.handleAIAction(args.matchId, args.roundNumber, args.playerWallet, args.action, args.clientNonce);
    });
    this.settlementService = new SettlementService(this.supabase);
    this.achievementService = new AchievementService(this.supabase);
    this.activeMatches = new Map();
    this.oracleSystem = new OracleSystemContractServer();
    this.combatEngine = new CombatEngine();
  }

  getActiveMatchCount(): number {
    return this.activeMatches.size;
  }

  /**
   * Checks if the given match uses the E.V.E bot by looking up the bot name.
   * Results are cached in a local map for the lifecycle of the match.
   */
  private eveBotMatchCache = new Map<number, boolean>();
  private litTraderMatchCache = new Map<number, boolean>();
  private botNameCache = new Map<number, string>();
  private async getBotName(matchId: number): Promise<string> {
    if (this.botNameCache.has(matchId)) return this.botNameCache.get(matchId)!;
    try {
      const { data: match } = await this.supabase
        .from('matches')
        .select('bot_id')
        .eq('match_id', matchId)
        .maybeSingle();
      if (!match?.bot_id) { this.botNameCache.set(matchId, 'default'); return 'default'; }
      const { data: bot } = await this.supabase
        .from('bots')
        .select('name')
        .eq('bot_id', match.bot_id)
        .maybeSingle();
      const name = bot?.name ?? 'default';
      this.botNameCache.set(matchId, name);
      return name;
    } catch {
      return 'default';
    }
  }

  private emitBotMessage(
    matchId: number,
    botWallet: string,
    trigger: BotDialogueTrigger,
    botName: string
  ) {
    const activeMatch = this.activeMatches.get(matchId);
    if (!activeMatch) return;
    const line = pickBotLine(botName, trigger);
    console.log(`[BOT DIALOGUE] match=${matchId} bot=${botName} trigger=${trigger} → "${line}"`);
    const message: BotMessageMessage = {
      type: 'bot_message',
      payload: {
        match_id: matchId,
        bot_wallet: botWallet,
        trigger,
        message: line,
      },
    };
    for (const ws of activeMatch.players.values()) {
      this.sendMessage(ws, message);
    }
  }

  private async isEVEMatch(matchId: number): Promise<boolean> {
    if (this.eveBotMatchCache.has(matchId)) {
      return this.eveBotMatchCache.get(matchId)!;
    }
    try {
      const { data: match } = await this.supabase
        .from('matches')
        .select('bot_id')
        .eq('match_id', matchId)
        .maybeSingle();
      if (!match?.bot_id) {
        this.eveBotMatchCache.set(matchId, false);
        return false;
      }
      const { data: bot } = await this.supabase
        .from('bots')
        .select('name')
        .eq('bot_id', match.bot_id)
        .maybeSingle();
      const isEVE = bot?.name === 'E.V.E';
      this.eveBotMatchCache.set(matchId, isEVE);
      return isEVE;
    } catch {
      return false;
    }
  }

  private async isLitTraderMatch(matchId: number): Promise<boolean> {
    if (this.litTraderMatchCache.has(matchId)) {
      return this.litTraderMatchCache.get(matchId)!;
    }
    try {
      const { data: match } = await this.supabase
        .from('matches')
        .select('bot_id')
        .eq('match_id', matchId)
        .maybeSingle();
      if (!match?.bot_id) {
        this.litTraderMatchCache.set(matchId, false);
        return false;
      }
      const { data: bot } = await this.supabase
        .from('bots')
        .select('name')
        .eq('bot_id', match.bot_id)
        .maybeSingle();
      const isLitTrader = bot?.name === 'Lit Trader';
      this.litTraderMatchCache.set(matchId, isLitTrader);
      return isLitTrader;
    } catch {
      return false;
    }
  }

  private async areBothPlayersInEvent(
    eventId: number,
    player1: string | null,
    player2: string | null
  ): Promise<boolean> {
    const p1 = player1?.toLowerCase() ?? null;
    const p2 = player2?.toLowerCase() ?? null;
    if (!p1 || !p2) return false;

    const { data: participants } = await this.supabase
      .from('event_participants')
      .select('player_wallet')
      .eq('event_id', eventId);

    const participantsSet = new Set(
      (participants ?? [])
        .map((row) => row.player_wallet?.toLowerCase())
        .filter((wallet): wallet is string => Boolean(wallet))
    );

    return participantsSet.has(p1) && participantsSet.has(p2);
  }

  private async shouldSettleMatchOnChain(match: MatchRow): Promise<boolean> {
    if (match.mode === 'VsAI') return false;
    if (match.mode !== 'Ranked1v1') return false;

    // Event-context matches do NOT settle on-chain per game.
    // Escrow is locked once at event registration and paid out at event end;
    // individual matches are only logged off-chain (leaderboard / SP).
    if (match.event_context_id) return false;

    // Non-event ranked matches settle on-chain only when escrow was locked
    // (i.e. there was a real per-match stake).
    return true;
  }

  private async ensureAIHasDeck(matchId: number, aiWallet: string): Promise<void> {
    const { data: matchPlayer } = await this.supabase
      .from('match_players')
      .select('bot_card_1_id, bot_card_2_id, bot_card_3_id')
      .eq('match_id', matchId)
      .eq('player_wallet', aiWallet)
      .maybeSingle();

    if (matchPlayer?.bot_card_1_id && matchPlayer?.bot_card_2_id && matchPlayer?.bot_card_3_id) {
      return;
    }

    const { data: match } = await this.supabase
      .from('matches')
      .select('bot_id')
      .eq('match_id', matchId)
      .maybeSingle();

    let assets: string[] = ['BTC', 'ETH', 'SOL'];
    let botStyle: { aggression: number; defense: number; charge_bias: number } | null = null;

    if (match?.bot_id) {
      const { data: bot } = await this.supabase
        .from('bots')
        .select('preferred_assets, aggression, defense, charge_bias')
        .eq('bot_id', match.bot_id)
        .maybeSingle();

      if (bot) {
        botStyle = {
          aggression: bot.aggression ?? 50,
          defense: bot.defense ?? 50,
          charge_bias: bot.charge_bias ?? 25,
        };
      }

      if (bot?.preferred_assets && Array.isArray(bot.preferred_assets) && bot.preferred_assets.length >= 3) {
        assets = bot.preferred_assets.slice(0, 3);
      } else if (bot?.preferred_assets && Array.isArray(bot.preferred_assets) && bot.preferred_assets.length > 0) {
        assets = [...bot.preferred_assets];
        const defaults = ['BTC', 'ETH', 'SOL', 'STRK', 'DOGE'];
        for (const def of defaults) {
          if (assets.length >= 3) break;
          if (!assets.includes(def)) assets.push(def);
        }
        assets = assets.slice(0, 3);
      }
    }
    const ensureBotCardsForTemplates = async (templateIds: number[]) => {
      if (templateIds.length === 0) return;
      await this.supabase
        .from('bot_cards')
        .upsert(templateIds.map((id) => ({ template_id: id })), { onConflict: 'template_id' });
    };

    const { data: preferredTemplates } = await this.supabase
      .from('card_templates')
      .select('template_id, asset, base, attack_affinity, defense_affinity, charge_affinity')
      .eq('is_ai_card', true)
      .in('asset', assets as CardAsset[]);

    const preferredTemplateIds = (preferredTemplates ?? []).map((t) => t.template_id);
    await ensureBotCardsForTemplates(preferredTemplateIds);

    let templates: Array<{
      id: number;
      template: {
        template_id: number;
        asset: CardAsset;
        base: number;
        attack_affinity: number;
        defense_affinity: number;
        charge_affinity: number | null;
      } | null;
    }> = [];

    if (preferredTemplateIds.length > 0) {
      const { data } = await this.supabase
        .from('bot_cards')
        .select('id, template:card_templates(template_id, asset, base, attack_affinity, defense_affinity, charge_affinity)')
        .in('template_id', preferredTemplateIds);
      templates = data ?? [];
    }

    if (templates.length < 3) {
      console.warn(
        `[AI DECK] Not enough bot_cards for assets: ${assets.join(', ')}, got ${templates.length}`
      );

      const { data: fallbackTemplates } = await this.supabase
        .from('card_templates')
        .select('template_id, asset, base, attack_affinity, defense_affinity, charge_affinity')
        .eq('is_ai_card', true)
        .order('template_id', { ascending: true });

      const existingTemplateIds = new Set(
        templates
          .map((t) => t.template?.template_id)
          .filter((id): id is number => Number.isFinite(id))
      );

      const useFallback = fallbackTemplates && fallbackTemplates.length > 0;
      const sourceTemplates = useFallback ? fallbackTemplates : [];

      if (!useFallback) {
        console.warn('[AI DECK] No AI-enabled templates found. Falling back to all templates.');
      }

      const { data: anyTemplates } = await this.supabase
        .from('card_templates')
        .select('template_id, asset, base, attack_affinity, defense_affinity, charge_affinity')
        .order('template_id', { ascending: true });

      if (!anyTemplates || anyTemplates.length === 0) {
        throw new Error('Cannot create AI deck: no templates found');
      }

      const supplemental = (useFallback ? sourceTemplates : anyTemplates).filter(
        (t) => !existingTemplateIds.has(t.template_id)
      );

      await ensureBotCardsForTemplates(supplemental.map((t) => t.template_id));

      const { data: refreshed } = await this.supabase
        .from('bot_cards')
        .select('id, template:card_templates(template_id, asset, base, attack_affinity, defense_affinity, charge_affinity)')
        .in('template_id', supplemental.map((t) => t.template_id));

      templates = [...templates, ...(refreshed ?? [])] as typeof templates;
    }

    if (templates.length < 3) {
      throw new Error('Cannot create AI deck: insufficient bot cards after fallback');
    }

    const scoredTemplates = templates
      .filter((entry) => entry.template)
      .map((template) => {
        const cardTemplate = template.template as {
          template_id: number;
          asset: CardAsset;
          base: number;
          attack_affinity: number;
          defense_affinity: number;
          charge_affinity: number | null;
        };
        const weights = this.getBotWeights(botStyle);
        const score =
          cardTemplate.attack_affinity * weights.attack +
          cardTemplate.defense_affinity * weights.defense +
          (cardTemplate.charge_affinity ?? 0) * weights.charge +
          cardTemplate.base * weights.base;
        return { template, score };
      });

    if (scoredTemplates.length < 3) {
      throw new Error('Cannot create AI deck: insufficient valid template data');
    }

    scoredTemplates.sort((a, b) => b.score - a.score);
    const selectedTemplates = scoredTemplates.slice(0, 3).map((entry) => entry.template);

    const updateData: MatchPlayersUpdate = {
      bot_card_1_id: selectedTemplates[0].id,
      bot_card_2_id: selectedTemplates[1].id,
      bot_card_3_id: selectedTemplates[2].id,
      bot_active_card_id: selectedTemplates[0].id,
    };

    const { error: updateError } = await this.supabase
      .from('match_players')
      .update(updateData)
      .eq('match_id', matchId)
      .eq('player_wallet', aiWallet);

    if (updateError) {
      console.error(`[AI DECK] Failed to assign cards:`, updateError);
      throw new Error(`Failed to assign AI deck: ${updateError.message}`);
    }
  }

  async handlePlayerJoin(matchId: number, playerWallet: string, ws: WebSocket) {
    const { data: match, error } = await this.supabase
      .from('matches')
      .select('*')
      .eq('match_id', matchId)
      .single<MatchesRow>();

    if (error || !match) {
      this.sendError(ws, 'Match not found');
      return;
    }

    if (match.player_1 !== playerWallet && match.player_2 !== playerWallet) {
      this.sendError(ws, 'You are not a participant in this match');
      return;
    }

    if (match.mode === 'VsAI' && match.player_2) {
      try {
        const isEVE = await this.isEVEMatch(matchId);
        if (isEVE) {
          await this.eveEngine.buildOptimalDeck(matchId, match.player_2);
        } else if (await this.isLitTraderMatch(matchId)) {
          await this.litTraderEngine.buildDeck(matchId, match.player_2);
        } else {
          await this.ensureAIHasDeck(matchId, match.player_2);
        }
      } catch (error) {
        console.error(`[MATCH] Failed to ensure AI deck:`, error);
      }
    }

    let activeMatch = this.activeMatches.get(matchId);
    if (!activeMatch) {
      const firstMover = Math.random() < 0.5 ? match.player_1 : (match.player_2 || match.player_1);

      activeMatch = {
        matchId,
        players: new Map(),
        roundTimer: null,
        roundEndTimestamp: 0,
        currentRoundActions: new Map(),
        currentRoundCards: new Map(),
        firstMoverWallet: firstMover,
        cloakUntilRoundByWallet: new Map(),
        disableChargeUntilRoundByWallet: new Map(),
        disableSwapUntilRoundByWallet: new Map(),
        escrowLocked: false,
        lastRoundBotTrigger: null,
      };
      this.activeMatches.set(matchId, activeMatch);
    }

    activeMatch.players.set(playerWallet, ws);

    if (match.status === 'WaitingForOpponent' && activeMatch.players.size === 2) {
      await this.startMatch(matchId);
    } else if (match.status === 'InProgress') {
      await this.sendMatchState(matchId, ws, playerWallet);
    }
  }

  async handlePlayerLeave(matchId: number, playerWallet: string) {
    const activeMatch = this.activeMatches.get(matchId);
    if (!activeMatch) return;

    activeMatch.players.delete(playerWallet);

    if (activeMatch.players.size === 0) {
      if (activeMatch.roundTimer) clearTimeout(activeMatch.roundTimer);
      this.activeMatches.delete(matchId);
    }
  }

  async handleCardSelection(payload: SelectCardMessage['payload']) {
    const { match_id, player_wallet, card_id, round_number } = payload;
    const activeMatch = this.activeMatches.get(match_id);
    if (!activeMatch) return;

    const mpUpdate: MatchPlayersUpdate = { active_card_id: card_id };
    await this.supabase
      .from('match_players')
      .update(mpUpdate)
      .eq('match_id', match_id)
      .eq('player_wallet', player_wallet);

    // Fetch the player card with its template
    const { data: joinedPlayerCard, error: playerCardError } = await this.supabase
      .from('player_cards')
      .select('id, owner_wallet, template_id, level, merge_count, acquired_at, template:card_templates(*)')
      .eq('id', card_id)
      .maybeSingle<PlayerCardWithFullTemplate>();

    if (playerCardError) {
      console.error(`[CARD SELECTION] Error fetching player card ${card_id}:`, playerCardError);
    }

    // Derive card asset  from template if available, otherwise fetch template directly by template_id
    let playerCard: PlayerCardWithFullTemplate | null = joinedPlayerCard ?? null;
    if (!playerCard) {
      const { data: baseCard, error: baseCardError } = await this.supabase
        .from('player_cards')
        .select('id, owner_wallet, template_id, level, merge_count, acquired_at')
        .eq('id', card_id)
        .maybeSingle<{
          id: number;
          owner_wallet: string;
          template_id: number;
          level: number;
          merge_count: number;
          acquired_at: string;
        }>();

      if (baseCardError) {
        console.error(`[CARD SELECTION] Error fetching base player card ${card_id}:`, baseCardError);
      }

      if (baseCard) {
        playerCard = {
          ...baseCard,
          template: null,
        };
      }
    }

    let cardAsset: CardAsset | null = playerCard?.template?.asset ?? null;

    if (!cardAsset && playerCard?.template_id) {
      console.warn(`[CARD SELECTION] Template join failed for card ${card_id}, fetching asset directly from card_templates.`);
      const { data: templateRow } = await this.supabase
        .from('card_templates')
        .select('*')
        .eq('template_id', playerCard.template_id)
        .maybeSingle<NonNullable<PlayerCardWithFullTemplate['template']>>();

      if (templateRow) {
        cardAsset = templateRow.asset;
        playerCard = {
          ...playerCard,
          template: templateRow,
        };
      } else {
        cardAsset = null;
      }
    }

    if (!cardAsset) {
      console.error(`[CARD SELECTION] Cannot determine card asset for card ${card_id}, player ${player_wallet}. Aborting broadcast.`);
      return;
    }

    activeMatch.currentRoundCards.set(player_wallet, cardAsset);

    for (const [wallet, opponentWs] of activeMatch.players.entries()) {
      if (wallet === player_wallet) continue;

      if (playerCard?.template) {
        this.sendMessage(opponentWs, {
          type: 'opponent_card_selected',
          payload: {
            match_id,
            round_number,
            opponent_wallet: player_wallet,
            card_asset: cardAsset,
            card: playerCard,
          },
        });
      } else {
        console.warn(`[CARD SELECTION] Sending opponent_card_selected without full template for card ${card_id}. Client will use asset-based image fallback.`);
        this.sendMessage(opponentWs, {
          type: 'opponent_card_selected',
          payload: {
            match_id,
            round_number,
            opponent_wallet: player_wallet,
            card_asset: cardAsset,
            card: null,
          },
        });
      }
    }
  }

  async handleActionSubmission(payload: SubmitActionMessage['payload']) {
    const { match_id, player_wallet, action, round_number, client_nonce } = payload;
    const activeMatch = this.activeMatches.get(match_id);
    if (!activeMatch) return;

    const { data: existingAction } = await this.supabase
      .from('match_actions')
      .select('match_id')
      .eq('match_id', match_id)
      .eq('round_number', round_number)
      .eq('player_wallet', player_wallet)
      .maybeSingle();

    if (existingAction) {
      const ws = activeMatch.players.get(player_wallet);
      if (ws) this.sendError(ws, 'Action already submitted');
      return;
    }

    if (action === 'Charge') {
      const opponentCharge = Array.from(activeMatch.currentRoundActions.entries()).find(
        ([wallet, act]) => wallet !== player_wallet && act === 'Charge'
      );

      if (opponentCharge) {
        const ws = activeMatch.players.get(player_wallet);
        if (ws) this.sendError(ws, 'Opponent already used Charge this round');
        return;
      }

      const { data: chargeRow } = await this.supabase
        .from('match_actions')
        .select('player_wallet')
        .eq('match_id', match_id)
        .eq('round_number', round_number)
        .eq('action', 'Charge')
        .maybeSingle();

      if (chargeRow && chargeRow.player_wallet !== player_wallet) {
        const ws = activeMatch.players.get(player_wallet);
        if (ws) this.sendError(ws, 'Opponent already used Charge this round');
        return;
      }

      const { data: mp } = await this.supabase
        .from('match_players')
        .select('charge_used')
        .eq('match_id', match_id)
        .eq('player_wallet', player_wallet)
        .single<Pick<MatchPlayersRow, 'charge_used'>>();

      if (mp?.charge_used) {
        const ws = activeMatch.players.get(player_wallet);
        if (ws) this.sendError(ws, 'Charge already used');
        return;
      }
    }

    const { data: match } = await this.supabase
      .from('matches')
      .select('player_1, player_2, mode')
      .eq('match_id', match_id)
      .single<Pick<MatchesRow, 'player_1' | 'player_2' | 'mode'>>();

    if (!match) return;

    const isOddRound = round_number % 2 === 1;
    const firstMoverStarts = isOddRound;
    const firstMoverWallet = activeMatch.firstMoverWallet;
    const secondMoverWallet = firstMoverWallet === match.player_1 ? match.player_2 : match.player_1;
    const expectedFirst = firstMoverStarts ? firstMoverWallet : secondMoverWallet;

    if (
      activeMatch.currentRoundActions.size === 0 &&
      expectedFirst &&
      player_wallet !== expectedFirst
    ) {
      const ws = activeMatch.players.get(player_wallet);
      if (ws) this.sendError(ws, 'Opponent must act first this round');
      return;
    }

    const disableChargeUntil = activeMatch.disableChargeUntilRoundByWallet.get(player_wallet);
    if (action === 'Charge' && disableChargeUntil && disableChargeUntil >= round_number) {
      const ws = activeMatch.players.get(player_wallet);
      if (ws) this.sendError(ws, 'Charge is disabled this round');
      return;
    }

    const isBot = match.mode === 'VsAI' && player_wallet === match.player_2;

    const { data: matchPlayer } = await this.supabase
      .from('match_players')
      .select('active_card_id, bot_active_card_id')
      .eq('match_id', match_id)
      .eq('player_wallet', player_wallet)
      .single<Pick<MatchPlayersRow, 'active_card_id' | 'bot_active_card_id'>>();

    let activeCardId = isBot ? matchPlayer?.bot_active_card_id : matchPlayer?.active_card_id;
    if (!activeCardId && isBot && match.player_2) {
      try {
        const isEVE = await this.isEVEMatch(match_id);
        if (isEVE) {
          await this.eveEngine.buildOptimalDeck(match_id, match.player_2);
        } else if (await this.isLitTraderMatch(match_id)) {
          await this.litTraderEngine.buildDeck(match_id, match.player_2);
        } else {
          await this.ensureAIHasDeck(match_id, match.player_2);
        }
        const { data: refreshed } = await this.supabase
          .from('match_players')
          .select('bot_active_card_id')
          .eq('match_id', match_id)
          .eq('player_wallet', player_wallet)
          .single<Pick<MatchPlayersRow, 'bot_active_card_id'>>();
        activeCardId = refreshed?.bot_active_card_id ?? null;
      } catch (error) {
        console.error('[AI] Failed to resolve bot active card:', error);
      }
    }
    if (!activeCardId) {
      console.error('[ACTION] Missing active card for action submission', {
        match_id,
        round_number,
        player_wallet,
        isBot,
      });
      return;
    }

    const insertAction: MatchActionsInsert = {
      match_id,
      round_number,
      player_wallet,
      action,
      card_id: isBot ? null : activeCardId,
      bot_card_id: isBot ? activeCardId : null,
      client_nonce,
    };

    const { error: insertError } = await this.supabase.from('match_actions').insert(insertAction);
    if (insertError) {
      console.error('[ACTION] Failed to insert match action:', insertError);
      return;
    }

    if (action === 'Charge') {
      await this.supabase
        .from('match_players')
        .update({ charge_used: true })
        .eq('match_id', match_id)
        .eq('player_wallet', player_wallet);
    }

    activeMatch.currentRoundActions.set(player_wallet, action);

    const allActionsSubmitted = activeMatch.currentRoundActions.size === 2;

    const opponent = this.getOpponent(player_wallet, activeMatch, match_id);
    if (opponent) {
      const opponentWs = activeMatch.players.get(opponent);
      if (opponentWs) {
        // If this is the first action, grant the waiting player a fresh timer
        let yourNewDeadline: number | undefined;
        if (!allActionsSubmitted && match.mode !== 'VsAI') {
          yourNewDeadline = Date.now() + ROUND_DURATION_MS;
          // Reset the server-side round timer to the new deadline
          if (activeMatch.roundTimer) clearTimeout(activeMatch.roundTimer);
          activeMatch.roundEndTimestamp = yourNewDeadline;
          activeMatch.roundTimer = setTimeout(() => {
            void this.handleRoundTimeout(match_id, round_number);
          }, ROUND_DURATION_MS);
          activeMatch.roundTimer.unref?.();
        }
        this.sendMessage(opponentWs, {
          type: 'opponent_action_locked',
          payload: {
            match_id,
            round_number,
            opponent_wallet: player_wallet,
            action,
            ...(yourNewDeadline !== undefined && { your_new_deadline: yourNewDeadline }),
          },
        });
      }
    } else if (match.mode === 'VsAI' && player_wallet === match.player_2) {
      for (const ws of activeMatch.players.values()) {
        this.sendMessage(ws, {
          type: 'opponent_action_locked',
          payload: {
            match_id,
            round_number,
            opponent_wallet: player_wallet,
            action,
          },
        });
      }
    }

    if (allActionsSubmitted) {
      await this.resolveRound(match_id, round_number);
    }

    if (
      match.mode === 'VsAI' &&
      player_wallet === match.player_1 &&
      activeMatch.currentRoundActions.size === 1
    ) {
      const aiIsFirstMover = activeMatch.firstMoverWallet === match.player_2;
      const aiShouldGoFirst = (aiIsFirstMover && firstMoverStarts) || (!aiIsFirstMover && !firstMoverStarts);
      if (!aiShouldGoFirst) {
        const isEVE = await this.isEVEMatch(match_id);
        if (isEVE) {
          await this.eveEngine.submitAIAction(match_id, round_number, match.player_2, true);
        } else if (await this.isLitTraderMatch(match_id)) {
          await this.litTraderEngine.submitAIAction(match_id, round_number, match.player_2, true);
        } else {
          await this.aiEngine.submitAIAction(match_id, round_number, match.player_2, true);
        }
      }
    }
  }

  private async handleAIAction(
    matchId: number,
    roundNumber: number,
    playerWallet: string,
    action: PlayerAction,
    clientNonce: string
  ) {
    await this.handleActionSubmission({
      match_id: matchId,
      round_number: roundNumber,
      player_wallet: playerWallet,
      action,
      client_nonce: clientNonce,
    });
  }

  async handleCardSwap(payload: SwapCardMessage['payload']) {
    const { match_id, player_wallet, new_card_id } = payload;

    const { data: matchPlayer } = await this.supabase
      .from('match_players')
      .select('swaps_used')
      .eq('match_id', match_id)
      .eq('player_wallet', player_wallet)
      .single<Pick<MatchPlayersRow, 'swaps_used'>>();

    if (!matchPlayer) return;

    const activeMatch = this.activeMatches.get(match_id);
    const disableSwapUntil = activeMatch?.disableSwapUntilRoundByWallet.get(player_wallet);
    if (disableSwapUntil && disableSwapUntil >= payload.round_number) {
      const ws = activeMatch?.players.get(player_wallet);
      if (ws) this.sendError(ws, 'Swap is disabled this round');
      return;
    }

    const { data: match } = await this.supabase
      .from('matches')
      .select('total_rounds, mode')
      .eq('match_id', match_id)
      .single<Pick<MatchesRow, 'total_rounds' | 'mode'>>();

    if (!match) return;

    let swapLimit = match.mode === 'VsAI' ? 999 : match.total_rounds === 10 ? 999 : 2;

    if (match.mode === 'Challenge') {
      const { data: challenge } = await (this.supabase as any)
        .from('challenge_invites')
        .select('swap_rule')
        .eq('match_id', match_id)
        .maybeSingle();
      swapLimit = getChallengeSwapLimit(match.total_rounds, challenge?.swap_rule ?? 'Strict');
    }

    if ((matchPlayer.swaps_used ?? 0) >= swapLimit) {
      const activeMatch = this.activeMatches.get(match_id);
      const ws = activeMatch?.players.get(player_wallet);
      if (ws) this.sendError(ws, 'Swap limit reached');
      return;
    }

    const update: MatchPlayersUpdate = {
      active_card_id: new_card_id,
      swaps_used: (matchPlayer.swaps_used ?? 0) + 1,
    };

    await this.supabase
      .from('match_players')
      .update(update)
      .eq('match_id', match_id)
      .eq('player_wallet', player_wallet);

    const clearCharge: MatchPlayersUpdate = {
      charge_armed: false,
      charged_card_id: null,
      charged_applies_round: null,
    };

    await this.supabase
      .from('match_players')
      .update(clearCharge)
      .eq('match_id', match_id)
      .eq('player_wallet', player_wallet)
      .eq('charged_card_id', new_card_id);
  }

  async handleChargeUse(payload: UseChargeMessage['payload']) {
    const { match_id, player_wallet, round_number } = payload;

    const { data: matchPlayer } = await this.supabase
      .from('match_players')
      .select('charge_used, active_card_id')
      .eq('match_id', match_id)
      .eq('player_wallet', player_wallet)
      .single<Pick<MatchPlayersRow, 'charge_used' | 'active_card_id'>>();

    if (!matchPlayer?.active_card_id) return;

    if (matchPlayer.charge_used) {
      const activeMatch = this.activeMatches.get(match_id);
      const ws = activeMatch?.players.get(player_wallet);
      if (ws) this.sendError(ws, 'Charge already used');
      return;
    }

    const update: MatchPlayersUpdate = {
      charge_used: true,
      charge_armed: true,
      charged_card_id: matchPlayer.active_card_id,
      charged_applies_round: round_number + 1,
    };

    await this.supabase
      .from('match_players')
      .update(update)
      .eq('match_id', match_id)
      .eq('player_wallet', player_wallet);
  }

  private async startMatch(matchId: number) {
    const { data: match } = await this.supabase
      .from('matches')
      .select('mode, player_1, player_2, event_context_id')
      .eq('match_id', matchId)
      .single();

    if (!match) {
      console.error(`[MATCH] Match ${matchId} not found`);
      return;
    }

    if (match.mode !== 'VsAI') {
      const { data: matchPlayers } = await this.supabase
        .from('match_players')
        .select('player_wallet, card_1_id, card_2_id, card_3_id, active_card_id')
        .eq('match_id', matchId);

      const allReady = (matchPlayers || []).length >= 2 && (matchPlayers || []).every((mp) =>
        Boolean(mp.card_1_id && mp.card_2_id && mp.card_3_id && mp.active_card_id)
      );

      if (!allReady) {
        return;
      }
    }

    if (match.mode === 'VsAI' && match.player_2) {
      try {
        const isEVE = await this.isEVEMatch(matchId);
        if (isEVE) {
          await this.eveEngine.buildOptimalDeck(matchId, match.player_2);
        } else if (await this.isLitTraderMatch(matchId)) {
          await this.litTraderEngine.buildDeck(matchId, match.player_2);
        } else {
          await this.ensureAIHasDeck(matchId, match.player_2);
        }
      } catch (error) {
        console.error(`[MATCH] Failed to create AI deck:`, error);
        return;
      }
    }
    await this.ensureBaselineSnapshot(matchId);

    const { data: round0 } = await this.supabase
      .from('match_rounds')
      .select('round_number')
      .eq('match_id', matchId)
      .eq('round_number', 0)
      .maybeSingle();

    if (!round0) {
      console.error(`[MATCH] Failed to create round 0 snapshot for match ${matchId}`);
      return;
    }
    // -- Lock escrow before the match starts (non-event ranked only) ------
    // Event matches do NOT lock per-match escrow; the entry fee is held at
    // the event level and paid out when the event concludes.
    // Only non-event Ranked1v1 matches with a real per-match stake lock here.
    if (match.mode === 'Ranked1v1' && !match.event_context_id) {
      try {
        const p1Stake = 0n;
        const p2Stake = 0n;

        await this.settlementService.lockMatchEscrow(matchId, p1Stake, p2Stake);
        if (p1Stake > 0n || p2Stake > 0n) {
          const am = this.activeMatches.get(matchId);
          if (am) am.escrowLocked = true;
        }
      } catch (escrowError) {
        console.error(`[MATCH] Failed to lock escrow for match ${matchId}:`, escrowError);
      }
    }

    const update: MatchesUpdate = {
      status: 'InProgress',
      started_at: new Date().toISOString(),
      current_round: 1,
    };

    await this.supabase.from('matches').update(update).eq('match_id', matchId);
    await this.startRound(matchId, 1);
  }

  private async startRound(matchId: number, roundNumber: number) {
    const activeMatch = this.activeMatches.get(matchId);
    if (!activeMatch) return;
    const { data: match } = await this.supabase
      .from('matches')
      .select('mode, player_1, player_2')
      .eq('match_id', matchId)
      .single<Pick<MatchesRow, 'mode' | 'player_1' | 'player_2'>>();

    if (!match) return;

    const prices = await this.fetchOraclePrices(matchId, roundNumber);

    const insertRound: MatchRoundsInsert = {
      match_id: matchId,
      round_number: roundNumber,
      btc_snapshot: Number.parseFloat(prices.btc),
      eth_snapshot: Number.parseFloat(prices.eth),
      strk_snapshot: Number.parseFloat(prices.strk),
      sol_snapshot: Number.parseFloat(prices.sol),
      doge_snapshot: Number.parseFloat(prices.doge),
      round_started_at: new Date().toISOString(),
    };

    await this.supabase.from('match_rounds').insert(insertRound);
    const isVsAI = match.mode === 'VsAI';

    const timerStartTime = Date.now() + SNAPSHOT_DISPLAY_DELAY_MS;
    const roundEndTimestamp = isVsAI ? 0 : timerStartTime + ROUND_DURATION_MS;
    activeMatch.roundEndTimestamp = roundEndTimestamp;

    activeMatch.currentRoundActions.clear();
    activeMatch.currentRoundCards.clear();

    if (match.mode === 'VsAI' && match.player_2) {
      const isEVE = await this.isEVEMatch(matchId);
      if (isEVE) {
        await this.eveEngine.buildOptimalDeck(matchId, match.player_2);

        // Fetch previous round prices so E.V.E can compute per-asset momentum
        let previousPrices: { btc: string; eth: string; strk: string; sol: string; doge: string } | undefined;
        if (roundNumber > 1) {
          const { data: prevRound } = await this.supabase
            .from('match_rounds')
            .select('*')
            .eq('match_id', matchId)
            .eq('round_number', roundNumber - 1)
            .maybeSingle<MatchRoundsRow>();
          if (prevRound) {
            previousPrices = {
              btc: String(prevRound.btc_snapshot ?? '0'),
              eth: String(prevRound.eth_snapshot ?? '0'),
              strk: String(prevRound.strk_snapshot ?? '0'),
              sol: String(prevRound.sol_snapshot ?? '0'),
              doge: String(prevRound.doge_snapshot ?? '0'),
            };
          }
        }

        const cardResult = await this.eveEngine.selectCardForRound(matchId, match.player_2, roundNumber, prices, previousPrices);
        // Broadcast the selected card to the human player
        if (cardResult && activeMatch) {
          activeMatch.currentRoundCards.set(match.player_2, cardResult.cardAsset as CardAsset);
          for (const ws of activeMatch.players.values()) {
            this.sendMessage(ws, {
              type: 'opponent_card_selected',
              payload: {
                match_id: matchId,
                round_number: roundNumber,
                opponent_wallet: match.player_2,
                card_asset: cardResult.cardAsset,
                card: cardResult.cardData,
              },
            });
          }
        }
      } else if (await this.isLitTraderMatch(matchId)) {
        await this.litTraderEngine.buildDeck(matchId, match.player_2);
        const cardResult = await this.litTraderEngine.selectCardForRound(matchId, match.player_2, roundNumber);
        if (cardResult && activeMatch) {
          activeMatch.currentRoundCards.set(match.player_2, cardResult.cardAsset as CardAsset);
          for (const ws of activeMatch.players.values()) {
            this.sendMessage(ws, {
              type: 'opponent_card_selected',
              payload: {
                match_id: matchId,
                round_number: roundNumber,
                opponent_wallet: match.player_2,
                card_asset: cardResult.cardAsset,
                card: cardResult.cardData,
              },
            });
          }
        }
      } else {
        await this.ensureAIHasDeck(matchId, match.player_2);
        await this.selectAICardForRound(matchId, match.player_2, roundNumber);
      }
    }

    for (const [wallet, ws] of activeMatch.players.entries()) {
      const opponent = wallet === match.player_1 ? match.player_2 : match.player_1;
      const cloakActive =
        Boolean(opponent) &&
        (activeMatch.cloakUntilRoundByWallet.get(opponent as string) ?? 0) >= roundNumber;
      const disableCharge =
        (activeMatch.disableChargeUntilRoundByWallet.get(wallet) ?? 0) >= roundNumber;
      const disableSwap =
        (activeMatch.disableSwapUntilRoundByWallet.get(wallet) ?? 0) >= roundNumber;

      const message: RoundStartMessage = {
        type: 'round_start',
        payload: {
          match_id: matchId,
          round_number: roundNumber,
          round_end_timestamp: roundEndTimestamp,
          first_mover_wallet: activeMatch.firstMoverWallet,
          btc_price: prices.btc,
          eth_price: prices.eth,
          strk_price: prices.strk,
          sol_price: prices.sol,
          doge_price: prices.doge,
          disable_charge: disableCharge,
          disable_swap: disableSwap,
          cloak_active: cloakActive,
        },
      };

      this.sendMessage(ws, message);
    }
    const isOddRound = roundNumber % 2 === 1;
    const firstMoverStarts = isOddRound;

    if (match.mode === 'VsAI' && match.player_2) {
      const aiIsFirstMover = activeMatch.firstMoverWallet === match.player_2;
      const aiShouldGoFirst = (aiIsFirstMover && firstMoverStarts) || (!aiIsFirstMover && !firstMoverStarts);
      if (aiShouldGoFirst) {
        const isEVE = await this.isEVEMatch(matchId);
        if (isEVE) {
          await this.eveEngine.submitAIAction(matchId, roundNumber, match.player_2, true);
        } else if (await this.isLitTraderMatch(matchId)) {
          await this.litTraderEngine.submitAIAction(matchId, roundNumber, match.player_2, true);
        } else {
          await this.aiEngine.submitAIAction(matchId, roundNumber, match.player_2, true);
        }
      }

      // Emit bot dialogue after the snapshot overlay clears (2500ms).
      // For rounds 2+, use the previous round's result trigger so the bot
      // references what just happened ("I wasn't surprised I won that round").
      // For round 1 (no prior result) always use 'round_start'.
      const botName = await this.getBotName(matchId);
      const pendingTrigger = roundNumber > 1 ? (activeMatch.lastRoundBotTrigger ?? 'round_start') : 'round_start';
      activeMatch.lastRoundBotTrigger = null;
      const aiWalletForDialogue = match.player_2;
      const t = setTimeout(() => {
        this.emitBotMessage(matchId, aiWalletForDialogue, pendingTrigger, botName);
      }, 3000 + Math.random() * 600);
      t.unref?.();
    }

    if (!isVsAI) {
      activeMatch.roundTimer = setTimeout(() => {
        void this.handleRoundTimeout(matchId, roundNumber);
      }, ROUND_DURATION_MS + SNAPSHOT_DISPLAY_DELAY_MS);

      activeMatch.roundTimer.unref?.();
    }
  }

  private async selectAICardForRound(matchId: number, aiWallet: string, roundNumber: number) {
    const { data: match } = await this.supabase
      .from('matches')
      .select('bot_id')
      .eq('match_id', matchId)
      .maybeSingle();

    let botStyle: { aggression: number; defense: number; charge_bias: number } | null = null;
    if (match?.bot_id) {
      const { data: bot } = await this.supabase
        .from('bots')
        .select('aggression, defense, charge_bias')
        .eq('bot_id', match.bot_id)
        .maybeSingle();

      if (bot) {
        botStyle = {
          aggression: bot.aggression ?? 50,
          defense: bot.defense ?? 50,
          charge_bias: bot.charge_bias ?? 25,
        };
      }
    }

    const { data: mp } = await this.supabase
      .from('match_players')
      .select('bot_card_1_id, bot_card_2_id, bot_card_3_id, bot_active_card_id')
      .eq('match_id', matchId)
      .eq('player_wallet', aiWallet)
      .maybeSingle<
        Pick<MatchPlayersRow, 'bot_card_1_id' | 'bot_card_2_id' | 'bot_card_3_id' | 'bot_active_card_id'>
      >();

    if (!mp) return;

    const options = [mp.bot_card_1_id, mp.bot_card_2_id, mp.bot_card_3_id].filter(Boolean) as number[];
    if (options.length === 0) return;

    let nextCard = options[Math.floor(Math.random() * options.length)];
    const activeMatch = this.activeMatches.get(matchId);
    const swapLocked =
      (activeMatch?.disableSwapUntilRoundByWallet.get(aiWallet) ?? 0) >= roundNumber;

    if (swapLocked && mp.bot_active_card_id) {
      nextCard = mp.bot_active_card_id;
    }

    if (!swapLocked) {
      const { data: deckCards } = await this.supabase
        .from('bot_cards')
        .select('id, template:card_templates(base, attack_affinity, defense_affinity, charge_affinity)')
        .in('id', options);

      if (deckCards && deckCards.length > 0) {
        const weights = this.getBotWeights(botStyle);
        const scored = deckCards
          .filter((c) => c.template)
          .map((c) => {
            const template = c.template as {
              base: number;
              attack_affinity: number;
              defense_affinity: number;
              charge_affinity: number;
            };
            const score =
              template.attack_affinity * weights.attack +
              template.defense_affinity * weights.defense +
              template.charge_affinity * weights.charge +
              template.base * weights.base;
            return { id: c.id as number, score: Math.max(0, score) };
          });

        const totalScore = scored.reduce((sum, item) => sum + item.score, 0);
        if (totalScore > 0) {
          let roll = Math.random() * totalScore;
          for (const item of scored) {
            roll -= item.score;
            if (roll <= 0) {
              nextCard = item.id;
              break;
            }
          }
        }
      }
    }

    await this.supabase
      .from('match_players')
      .update({ bot_active_card_id: nextCard })
      .eq('match_id', matchId)
      .eq('player_wallet', aiWallet);
    // Fetch full card data for broadcast
    const { data: cardData, error: cardDataError } = await this.supabase
      .from('bot_cards')
      .select('id, template_id, level, merge_count, created_at, updated_at, template:card_templates(*)')
      .eq('id', nextCard)
      .single<BotCardWithTemplate>();

    if (cardDataError) {
      console.error(`[AI] Error fetching bot card ${nextCard}:`, cardDataError);
    }

    // Derive asset  from template if available, otherwise fetch directly by template_id
    let cardAsset: CardAsset | null = cardData?.template?.asset ?? null;

    if (!cardAsset && cardData?.template_id) {
      console.warn(`[AI] Template join failed for bot card ${nextCard}, fetching asset directly.`);
      const { data: templateRow } = await this.supabase
        .from('card_templates')
        .select('asset')
        .eq('template_id', cardData.template_id)
        .maybeSingle<{ asset: CardAsset }>();
      cardAsset = templateRow?.asset ?? null;
    }

    if (!cardAsset) {
      console.error(`[AI] Cannot determine card asset for bot card ${nextCard}. Skipping broadcast.`);
      return;
    }

    if (activeMatch) {
      activeMatch.currentRoundCards.set(aiWallet, cardAsset);

      // Always broadcast  with full card data if available, asset-only if not
      for (const ws of activeMatch.players.values()) {
        if (cardData?.template) {
          this.sendMessage(ws, {
            type: 'opponent_card_selected',
            payload: {
              match_id: matchId,
              round_number: roundNumber,
              opponent_wallet: aiWallet,
              card_asset: cardAsset,
              card: cardData,
            },
          });
        } else {
          console.warn(`[AI] Sending opponent_card_selected without full template for bot card ${nextCard}. Client will use asset-based image fallback.`);
          this.sendMessage(ws, {
            type: 'opponent_card_selected',
            payload: {
              match_id: matchId,
              round_number: roundNumber,
              opponent_wallet: aiWallet,
              card_asset: cardAsset,
              card: null,
            },
          });
        }
      }
    }
  }

  private async handleRoundTimeout(matchId: number, roundNumber: number) {
    const activeMatch = this.activeMatches.get(matchId);
    if (!activeMatch) return;

    const { data: match } = await this.supabase
      .from('matches')
      .select('player_1, player_2, mode, status')
      .eq('match_id', matchId)
      .single<Pick<MatchesRow, 'player_1' | 'player_2' | 'mode' | 'status'>>();

    if (!match) return;
    if (match.status === 'Completed' || match.status === 'Cancelled') {
      if (activeMatch.roundTimer) clearTimeout(activeMatch.roundTimer);
      this.activeMatches.delete(matchId);
      return;
    }
    if (match.mode === 'VsAI') return;

    const players = [match.player_1, match.player_2].filter(Boolean) as string[];

    for (const player of players) {
      if (!activeMatch.currentRoundActions.has(player)) {
        const { data: matchPlayer } = await this.supabase
          .from('match_players')
          .select('active_card_id')
          .eq('match_id', matchId)
          .eq('player_wallet', player)
          .single<Pick<MatchPlayersRow, 'active_card_id'>>();

        const insertAction: MatchActionsInsert = {
          match_id: matchId,
          round_number: roundNumber,
          player_wallet: player,
          action: 'NoAction',
          card_id: matchPlayer?.active_card_id ?? null,
          client_nonce: `timeout-${Date.now()}`,
        };

        await this.supabase.from('match_actions').insert(insertAction);
        activeMatch.currentRoundActions.set(player, 'NoAction');
      }
    }

    await this.resolveRound(matchId, roundNumber);
  }

  private async resolveRound(matchId: number, roundNumber: number) {
    const activeMatch = this.activeMatches.get(matchId);
    if (!activeMatch) return;

    if (activeMatch.roundTimer) {
      clearTimeout(activeMatch.roundTimer);
      activeMatch.roundTimer = null;
    }
    const { data: match } = await this.supabase
      .from('matches')
      .select('*')
      .eq('match_id', matchId)
      .single<MatchRow>();

    if (!match) return;

    if (match.status === 'Completed' || match.status === 'Cancelled') {
      this.activeMatches.delete(matchId);
      return;
    }

    const { data: round } = await this.supabase
      .from('match_rounds')
      .select('*')
      .eq('match_id', matchId)
      .eq('round_number', roundNumber)
      .single<MatchRoundsRow>();

    if (!round) return;

    const { data: actions } = await this.supabase
      .from('match_actions')
      .select('*')
      .eq('match_id', matchId)
      .eq('round_number', roundNumber)
      .returns<MatchActionsRow[]>();

    if (!actions || actions.length !== 2) {
      console.error(`[RESOLVE] Expected 2 actions, got ${actions?.length || 0}`);
      return;
    }

    const p1Action = actions.find((a) => a.player_wallet === match.player_1);
    const p2Action = actions.find((a) => a.player_wallet === match.player_2);

    if (!p1Action || !p2Action) return;
    const outcome = await this.computeRoundOutcome(match, round, p1Action, p2Action, activeMatch);
    if (!outcome) {
      console.error(`[RESOLVE] Failed to compute outcome`);
      return;
    }

    const { winner, p1Damage, p2Damage } = outcome;
    const updates: MatchesUpdate = {};
    if (winner === match.player_1) updates.p1_rounds_won = (match.p1_rounds_won ?? 0) + 1;
    else if (winner === match.player_2) updates.p2_rounds_won = (match.p2_rounds_won ?? 0) + 1;

    await this.supabase.from('matches').update(updates).eq('match_id', matchId);

    const roundUpdate: MatchRoundsUpdate = {
      p1_action: p1Action.action,
      p2_action: p2Action.action,
      winner,
      round_ended_at: new Date().toISOString(),
    };

    await this.supabase
      .from('match_rounds')
      .update(roundUpdate)
      .eq('match_id', matchId)
      .eq('round_number', roundNumber);

    await this.updateEventDamageForRound(match, p1Damage, p2Damage);

    await this.broadcastMomentumReveal(match, roundNumber, round, activeMatch);

    const updatedP1Rounds = updates.p1_rounds_won ?? (match.p1_rounds_won ?? 0);
    const updatedP2Rounds = updates.p2_rounds_won ?? (match.p2_rounds_won ?? 0);

    const activeMatchForRoundEnd = this.activeMatches.get(matchId);
    if (activeMatchForRoundEnd) {
      for (const [wallet, ws] of activeMatchForRoundEnd.players.entries()) {
        const opponent = wallet === match.player_1 ? match.player_2 : match.player_1;
        const cloakActive =
          Boolean(opponent) &&
          (activeMatchForRoundEnd.cloakUntilRoundByWallet.get(opponent as string) ?? 0) >= roundNumber;

        const roundEndMessage: RoundEndMessage = {
          type: 'round_end',
          payload: {
            match_id: matchId,
            round_number: roundNumber,
            winner,
            p1_damage: p1Damage,
            p2_damage: p2Damage,
            p1_rounds_won: updatedP1Rounds,
            p2_rounds_won: updatedP2Rounds,
            cloak_active: cloakActive,
          },
        };

        this.sendMessage(ws, roundEndMessage);
      }
    }

    const roundsToWin = Math.floor((match.total_rounds ?? 0) / 2) + 1;
    const isMatchOver = Boolean(winner && (updatedP1Rounds >= roundsToWin || updatedP2Rounds >= roundsToWin));

    // Store result so next round's opening line references what just happened.
    // For the final round the endMatch handler emits its own match_won/lost line.
    if (match.mode === 'VsAI' && match.player_2 && !isMatchOver && activeMatch) {
      activeMatch.lastRoundBotTrigger =
        winner === match.player_2 ? 'round_won'
        : winner === match.player_1 ? 'round_lost'
        : 'round_draw';
    }

    if (isMatchOver) {
      await this.endMatch(matchId, winner!);
      return;
    }

    if (roundNumber < (match.total_rounds ?? 0)) {
      const t = setTimeout(() => {
        void this.startRound(matchId, roundNumber + 1);
      }, 10000);
      t.unref?.();
      return;
    }

    if (updatedP1Rounds === updatedP2Rounds) {
      await this.endMatch(matchId, null);
      return;
    }

    const finalWinner = updatedP1Rounds > updatedP2Rounds ? match.player_1 : match.player_2;
    await this.endMatch(matchId, finalWinner);
  }

  private async computeRoundOutcome(
    match: MatchRow,
    round: MatchRoundsRow,
    p1Action: MatchActionsRow,
    p2Action: MatchActionsRow,
    activeMatch: ActiveMatch
  ): Promise<{ winner: string | null; p1Damage: number; p2Damage: number } | null> {
    const p1NoAction = p1Action.action === 'NoAction';
    const p2NoAction = p2Action.action === 'NoAction';

    if (p1NoAction || p2NoAction) {
      if (p1NoAction && p2NoAction) {
        return { winner: null, p1Damage: 0, p2Damage: 0 };
      }
      if (p1NoAction) {
        return { winner: match.player_2 ?? null, p1Damage: 0, p2Damage: 0 };
      }
      return { winner: match.player_1 ?? null, p1Damage: 0, p2Damage: 0 };
    }

    const playerCardIds = [p1Action.card_id, p2Action.card_id].filter(Boolean) as number[];
    const botCardIds = [p1Action.bot_card_id, p2Action.bot_card_id].filter(Boolean) as number[];

    const { data: playerCards } = playerCardIds.length
      ? await this.supabase
          .from('player_cards')
          .select(
            'id, level, owner_wallet, template:card_templates(template_id, asset, base, attack_affinity, defense_affinity, charge_affinity, volatility_sensitivity, ability_id)'
          )
          .in('id', playerCardIds)
          .returns<{ id: number; level: number; owner_wallet: string; template: TemplateStats | null }[]>()
      : { data: [] };

    const { data: botCards } = botCardIds.length
      ? await this.supabase
          .from('bot_cards')
          .select(
            'id, level, template:card_templates(template_id, asset, base, attack_affinity, defense_affinity, charge_affinity, volatility_sensitivity, ability_id)'
          )
          .in('id', botCardIds)
          .returns<{ id: number; level: number; template: TemplateStats | null }[]>()
      : { data: [] };

    const p1Card = p1Action.card_id
      ? playerCards?.find((c) => c.id === p1Action.card_id)
      : botCards?.find((c) => c.id === p1Action.bot_card_id);
    const p2Card = p2Action.card_id
      ? playerCards?.find((c) => c.id === p2Action.card_id)
      : botCards?.find((c) => c.id === p2Action.bot_card_id);

    if (!p1Card?.template || !p2Card?.template) return null;

    const p1Asset = p1Card.template.asset;
    const p2Asset = p2Card.template.asset;

    const p1Snapshot = this.getSnapshotPrice(round, p1Asset);
    const p2Snapshot = this.getSnapshotPrice(round, p2Asset);

    const p1Prev = await this.getPreviousSnapshotPrice(
      match.match_id,
      round.round_number,
      p1Asset,
      p1Snapshot
    );
    const p2Prev = await this.getPreviousSnapshotPrice(
      match.match_id,
      round.round_number,
      p2Asset,
      p2Snapshot
    );
    const p1Momentum = this.calculateMomentumDecimal(p1Prev, p1Snapshot, `P1(${p1Asset})`);
    const p2Momentum = this.calculateMomentumDecimal(p2Prev, p2Snapshot, `P2(${p2Asset})`);
    const abilityIds = [p1Card.template.ability_id, p2Card.template.ability_id].filter(Boolean);
    const { data: abilities } = await this.supabase
      .from('abilities')
      .select('ability_id, trigger_type, effect_type, config')
      .in('ability_id', abilityIds)
      .returns<AbilityRow[]>();

    const abilityMap = new Map<string, AbilityRow>();
    for (const ability of abilities ?? []) {
      abilityMap.set(ability.ability_id, ability);
    }

    if (p1Action.action === 'Charge') {
      this.applyStatusAbilities(
        abilityMap.get(p1Card.template.ability_id),
        match.player_1,
        match.player_2,
        round.round_number,
        activeMatch
      );
    }
    if (p2Action.action === 'Charge') {
      this.applyStatusAbilities(
        abilityMap.get(p2Card.template.ability_id),
        match.player_2,
        match.player_1,
        round.round_number,
        activeMatch
      );
    }

    const p1Effects =
      p1Action.action === 'Charge'
        ? this.buildAbilityEffects(abilityMap.get(p1Card.template.ability_id), {
            playerMomentum: p1Momentum,
            playerAction: p1Action.action as PlayerAction,
            opponentAction: p2Action.action as PlayerAction,
          })
        : { self: [], opponent: [] };

    const p2Effects =
      p2Action.action === 'Charge'
        ? this.buildAbilityEffects(abilityMap.get(p2Card.template.ability_id), {
            playerMomentum: p2Momentum,
            playerAction: p2Action.action as PlayerAction,
            opponentAction: p1Action.action as PlayerAction,
          })
        : { self: [], opponent: [] };

    const result = this.combatEngine.resolveCombat({
      playerCard: { ...p1Card.template, level: p1Card.level ?? 1 },
      opponentCard: { ...p2Card.template, level: p2Card.level ?? 1 },
      playerAction: p1Action.action as PlayerAction,
      opponentAction: p2Action.action as PlayerAction,
      playerMomentum: p1Momentum,
      opponentMomentum: p2Momentum,
      playerChargeActive: p1Action.action === 'Charge',
      opponentChargeActive: p2Action.action === 'Charge',
      playerAbilityEffects: [...p1Effects.self, ...p2Effects.opponent],
      opponentAbilityEffects: [...p1Effects.opponent, ...p2Effects.self],
    });
    const winner =
      result.winner === 'player'
        ? match.player_1
        : result.winner === 'opponent'
          ? match.player_2
          : null;

    return {
      winner,
      p1Damage: Math.round(result.opponentDamage),
      p2Damage: Math.round(result.playerDamage),
    };
  }

  private async ensureBaselineSnapshot(matchId: number) {
    const { data: existing } = await this.supabase
      .from('match_rounds')
      .select('round_number')
      .eq('match_id', matchId)
      .eq('round_number', 0)
      .maybeSingle();

    if (existing) {
      return;
    }
    const prices = await this.fetchOraclePrices(matchId, 0);

    const insertRound: MatchRoundsInsert = {
      match_id: matchId,
      round_number: 0,
      btc_snapshot: Number.parseFloat(prices.btc),
      eth_snapshot: Number.parseFloat(prices.eth),
      strk_snapshot: Number.parseFloat(prices.strk),
      sol_snapshot: Number.parseFloat(prices.sol),
      doge_snapshot: Number.parseFloat(prices.doge),
      round_started_at: new Date().toISOString(),
      round_ended_at: new Date().toISOString(),
    };

    const { error } = await this.supabase.from('match_rounds').insert(insertRound);
    if (error) {
      console.error('[BASELINE] Failed to create round 0 snapshot:', error.message);
      throw new Error(`Failed to create baseline snapshot: ${error.message}`);
    }
  }

  private buildAbilityEffects(
    ability: AbilityRow | undefined,
    context: {
      playerMomentum: number;
      playerAction: PlayerAction;
      opponentAction: PlayerAction;
    }
  ): { self: AbilityEffect[]; opponent: AbilityEffect[] } {
    const self: AbilityEffect[] = [];
    const opponent: AbilityEffect[] = [];

    if (!ability) return { self, opponent };

    const config = ability.config ?? {};
    const { playerMomentum, opponentAction } = context;
    const customAbilityIds = new Set([
      'btc_halving_pressure',
      'strk_zk_cloak',
      'doge_loyal_guard',
      'sol_desync',
      'eth_gas_surge',
    ]);

    if (!customAbilityIds.has(ability.ability_id)) {
      switch (ability.effect_type) {
        case 'momentum_amplifier': {
          const multiplier = Number(config.multiplier);
          if (Number.isFinite(multiplier) && multiplier > 1) {
            const boost = multiplier - 1;
            if (boost > 0) self.push({ type: 'momentum_boost', value: boost });
          }
          const defensePenalty = Number(config.defense_penalty);
          if (Number.isFinite(defensePenalty) && defensePenalty > 0) {
            opponent.push({ type: 'defense_penalty', value: defensePenalty });
          }
          break;
        }
        case 'visibility_denial': {
          const focusPenalty = Number(config.focus_penalty ?? config.defense_penalty);
          if (Number.isFinite(focusPenalty) && focusPenalty > 0) {
            opponent.push({ type: 'defense_penalty', value: focusPenalty });
          }
          break;
        }
        case 'defensive_reflect': {
          const threshold = Number(config.momentum_threshold);
          const normalizedThreshold =
            Number.isFinite(threshold) && Math.abs(threshold) > 1 ? threshold / 10000 : threshold;
          const allow =
            !Number.isFinite(normalizedThreshold) || playerMomentum >= (normalizedThreshold ?? 0);
          if (allow) opponent.push({ type: 'block_action' });
          break;
        }
        case 'action_lock': {
          opponent.push({ type: 'block_action' });
          break;
        }
        case 'momentum_stabilizer': {
          if (config.ignore_negative_momentum) {
            self.push({ type: 'ignore_negative' });
          }
          const focusBoost = Number(config.focus_boost);
          if (Number.isFinite(focusBoost) && focusBoost !== 0) {
            self.push({ type: 'momentum_boost', value: focusBoost / 100 });
          }
          break;
        }
        default:
          break;
      }
    }

    switch (ability.ability_id) {
      case 'btc_halving_pressure': {
        const multiplier = Number(config.damage_multiplier ?? 0.5);
        if (Number.isFinite(multiplier) && multiplier > 0) {
          self.push({ type: 'damage_taken_multiplier', value: multiplier });
        }
        break;
      }
      case 'doge_loyal_guard': {
        if (opponentAction === 'Attack') {
          const multiplier = Number(config.attack_damage_multiplier ?? 0.75);
          if (Number.isFinite(multiplier) && multiplier > 0) {
            self.push({ type: 'damage_taken_multiplier', value: multiplier });
          }
        }
        break;
      }
      case 'eth_gas_surge': {
        if (playerMomentum < 0) {
          const multiplier = Number(config.damage_multiplier ?? 0.8);
          if (Number.isFinite(multiplier) && multiplier > 0) {
            self.push({ type: 'damage_taken_multiplier', value: multiplier });
          }
        }
        break;
      }
      default:
        break;
    }

    return { self, opponent };
  }

  private applyStatusAbilities(
    ability: AbilityRow | undefined,
    playerWallet: string,
    opponentWallet: string,
    roundNumber: number,
    activeMatch: ActiveMatch
  ) {
    if (!ability) return;

    switch (ability.ability_id) {
      case 'strk_zk_cloak': {
        const rounds = Number(ability.config?.cloak_rounds ?? 2);
        const untilRound = roundNumber + Math.max(1, rounds - 1);
        activeMatch.cloakUntilRoundByWallet.set(playerWallet, untilRound);
        break;
      }
      case 'sol_desync': {
        const duration = Number(ability.config?.duration_rounds ?? 1);
        const untilRound = roundNumber + Math.max(1, duration);
        activeMatch.disableChargeUntilRoundByWallet.set(opponentWallet, untilRound);
        activeMatch.disableSwapUntilRoundByWallet.set(opponentWallet, untilRound);
        break;
      }
      default:
        break;
    }
  }

  private getSnapshotPrice(round: MatchRoundsRow, asset: CardAsset): string {
    switch (asset) {
      case 'BTC':
        return String(round.btc_snapshot ?? '0');
      case 'ETH':
        return String(round.eth_snapshot ?? '0');
      case 'STRK':
        return String(round.strk_snapshot ?? '0');
      case 'SOL':
        return String(round.sol_snapshot ?? '0');
      case 'DOGE':
        return String(round.doge_snapshot ?? '0');
      default:
        return '0';
    }
  }

  private async getPreviousSnapshotPrice(
    matchId: number,
    roundNumber: number,
    asset: CardAsset,
    fallbackSnapshot: string
  ): Promise<string> {
    const previousRoundNumber = roundNumber - 1;
    const { data: previous } = await this.supabase
      .from('match_rounds')
      .select('*')
      .eq('match_id', matchId)
      .eq('round_number', previousRoundNumber)
      .maybeSingle<MatchRoundsRow>();

    if (!previous) {
      console.warn(`[SNAPSHOT] No round ${previousRoundNumber} found, using fallback ${fallbackSnapshot}`);
      return fallbackSnapshot;
    }

    const price = this.getSnapshotPrice(previous, asset);
    return price;
  }

  private calculateMomentumDecimal(previousSnapshot: string, currentSnapshot: string, assetName?: string): number {
    const prev = Number.parseFloat(previousSnapshot);
    const curr = Number.parseFloat(currentSnapshot);
    const asset = assetName || 'Unknown';
    if (!Number.isFinite(prev)) {
      console.error(`[MOMENTUM CALC] ${asset} - Invalid previous snapshot: "${previousSnapshot}"`);
      return 0;
    }

    if (prev <= 0) {
      console.error(`[MOMENTUM CALC] ${asset} - Previous must be positive, got: ${prev}`);
      return 0;
    }

    if (!Number.isFinite(curr)) {
      console.error(`[MOMENTUM CALC] ${asset} - Invalid current snapshot: "${currentSnapshot}"`);
      return 0;
    }

    const momentum = (curr - prev) / prev;
    const momentumPercent = (momentum * 100).toFixed(4);
    return momentum;
  }

  private calculateMomentumBpsFromDecimal(momentum: number): number {
    return Math.round(momentum * 10000);
  }

  private async broadcastMomentumReveal(
    match: MatchRow,
    roundNumber: number,
    round: MatchRoundsRow,
    activeMatch: ActiveMatch
  ) {
    const p1Asset = activeMatch.currentRoundCards.get(match.player_1) ?? 'BTC';
    const p2Asset = activeMatch.currentRoundCards.get(match.player_2) ?? 'ETH';

    const p1Snapshot = this.getSnapshotPrice(round, p1Asset);
    const p2Snapshot = this.getSnapshotPrice(round, p2Asset);
    const p1Prev = await this.getPreviousSnapshotPrice(
      match.match_id,
      roundNumber,
      p1Asset,
      p1Snapshot
    );
    const p2Prev = await this.getPreviousSnapshotPrice(
      match.match_id,
      roundNumber,
      p2Asset,
      p2Snapshot
    );

    const p1MomentumDecimal = this.calculateMomentumDecimal(p1Prev, p1Snapshot, `P1(${p1Asset})`);
    const p2MomentumDecimal = this.calculateMomentumDecimal(p2Prev, p2Snapshot, `P2(${p2Asset})`);
    const p1Momentum = this.calculateMomentumBpsFromDecimal(p1MomentumDecimal);
    const p2Momentum = this.calculateMomentumBpsFromDecimal(p2MomentumDecimal);

    for (const [wallet, ws] of activeMatch.players.entries()) {
      const opponent = wallet === match.player_1 ? match.player_2 : match.player_1;
      const cloakActive =
        Boolean(opponent) &&
        (activeMatch.cloakUntilRoundByWallet.get(opponent as string) ?? 0) >= roundNumber;

      const message: MomentumRevealMessage = {
        type: 'momentum_reveal',
        payload: {
          match_id: match.match_id,
          round_number: roundNumber,
          p1_momentum_percent: p1Momentum,
          p2_momentum_percent: p2Momentum,
          p1_base_price: p1Prev,
          p2_base_price: p2Prev,
          p1_snapshot_price: p1Snapshot,
          p2_snapshot_price: p2Snapshot,
          cloak_active: cloakActive,
        },
      };

      this.sendMessage(ws, message);
    }
  }

  private async endMatch(matchId: number, winner: string | null) {
    const { data: match } = await this.supabase
      .from('matches')
      .select('*')
      .eq('match_id', matchId)
      .single<MatchRow>();

    if (!match) return;

    if (match.status === 'Completed' || match.status === 'Cancelled') {
      const activeMatch = this.activeMatches.get(matchId);
      if (activeMatch?.roundTimer) clearTimeout(activeMatch.roundTimer);
      this.activeMatches.delete(matchId);
      return;
    }

    const transcriptHash = await this.settlementService.generateTranscriptHash(matchId);

    const update: MatchesUpdate = {
      status: 'Completed',
      winner,
      ended_at: new Date().toISOString(),
      transcript_hash: transcriptHash,
    };

    await this.supabase.from('matches').update(update).eq('match_id', matchId);

    const message: MatchEndMessage = {
      type: 'match_end',
      payload: {
        match_id: matchId,
        winner,
        p1_rounds_won: match.p1_rounds_won ?? 0,
        p2_rounds_won: match.p2_rounds_won ?? 0,
        transcript_hash: transcriptHash,
      },
    };

    // Emit bot match-end dialogue BEFORE match_end so the client receives it
    // while the component is still mounted and can persist it to sessionStorage.
    if (match.mode === 'VsAI' && match.player_2) {
      const botName = await this.getBotName(matchId);
      const matchTrigger: BotDialogueTrigger =
        winner === match.player_2 ? 'match_won'
        : winner === match.player_1 ? 'match_lost'
        : 'match_draw';
      this.emitBotMessage(matchId, match.player_2, matchTrigger, botName);
    }

    // Check and emit any newly-unlocked achievements BEFORE match_end so
    // clients are still connected when they receive the notifications.
    {
      const aiWallet = '0x4149';
      const humanWallets = ([match.player_1, match.player_2] as Array<string | null>).filter(
        (w): w is string => typeof w === 'string' && w.toLowerCase() !== aiWallet
      );
      const activeMatchForAchv = this.activeMatches.get(matchId);
      if (activeMatchForAchv && humanWallets.length > 0) {
        const botName = match.mode === 'VsAI' ? await this.getBotName(matchId) : undefined;
        for (const playerWallet of humanWallets) {
          try {
            const playerRoundsWon =
              playerWallet === match.player_1
                ? (match.p1_rounds_won ?? 0)
                : (match.p2_rounds_won ?? 0);
            const opponentRoundsWon =
              playerWallet === match.player_1
                ? (match.p2_rounds_won ?? 0)
                : (match.p1_rounds_won ?? 0);

            const { data: actions } = await this.supabase
              .from('match_actions')
              .select('action, round_number')
              .eq('match_id', matchId)
              .eq('player_wallet', playerWallet);

            const usedCharge = (actions ?? []).some((a) => a.action === 'Charge');
            const defendedRound1 = (actions ?? []).some(
              (a) => a.round_number === 1 && a.action === 'Defend'
            );

            const ctx: MatchAchievementContext = {
              matchId,
              playerWallet,
              mode: match.mode,
              isWinner: winner === playerWallet,
              playerRoundsWon,
              opponentRoundsWon,
              totalRounds: match.total_rounds,
              botName,
              usedCharge,
              defendedRound1,
            };

            const unlocks = await this.achievementService.checkMatchAchievements(ctx);
            const playerWs = activeMatchForAchv.players.get(playerWallet);
            if (playerWs && unlocks.length > 0) {
              for (const acv of unlocks) {
                const msg: AchievementUnlockedMessage = {
                  type: 'achievement_unlocked',
                  payload: {
                    match_id: matchId,
                    player_wallet: playerWallet,
                    achievement_key: acv.key,
                    title: acv.title,
                    description: acv.description,
                    category: acv.category,
                    tier: acv.tier,
                    badge_icon: acv.badge_icon,
                    badge_color: acv.badge_color,
                  },
                };
                this.sendMessage(playerWs, msg);
              }
            }
          } catch (achvErr) {
            console.error(
              `[ACHIEVEMENT] Failed to check achievements for ${playerWallet}:`,
              achvErr
            );
          }
        }
      }
    }

    this.broadcastToMatch(matchId, message);

    if (winner) {
      try {
        const activeMatch = this.activeMatches.get(matchId);
        const escrowWasLocked = activeMatch?.escrowLocked ?? false;
        const shouldSettle = escrowWasLocked && await this.shouldSettleMatchOnChain(match);
        if (shouldSettle) {
          await this.settlementService.settleMatch(
            matchId,
            winner,
            match.p1_rounds_won ?? 0,
            match.p2_rounds_won ?? 0,
            transcriptHash
          );
        } else if (!escrowWasLocked) {
        }
      } catch (settlementError) {
        // Settlement failures must not block leaderboard/SP/room updates.
        console.error(`[MATCH] Settlement failed for match ${matchId}:`, settlementError);
      }
    }

    await this.updateStarkPointsForMatch(match, winner);
    await this.updateEventStandingsForMatch(match, winner);
    await this.updateRoomAfterMatch(match, winner);
    await this.pruneCompletedRankedMatches();

    const activeMatch = this.activeMatches.get(matchId);
    if (activeMatch?.roundTimer) clearTimeout(activeMatch.roundTimer);
    this.activeMatches.delete(matchId);
    this.eveBotMatchCache.delete(matchId);
    this.litTraderMatchCache.delete(matchId);
    this.botNameCache.delete(matchId);
    this.eveEngine.cleanupMatch(matchId);
    this.litTraderEngine.cleanupMatch(matchId);
  }

  private async pruneCompletedRankedMatches() {
    // Keep a short retention window so recent results pages keep working,
    // while old completed ranked/event matches do not accumulate forever.
    const cutoffIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { error } = await this.supabase
      .from('matches')
      .delete()
      .eq('mode', 'Ranked1v1')
      .eq('status', 'Completed')
      .is('room_context_id', null)
      .lt('ended_at', cutoffIso);

    if (error) {
      console.error('[MATCH] Failed to prune old completed ranked matches:', error);
    }
  }

  private async updateRoomAfterMatch(match: MatchRow, winner: string | null) {
    const roomId = match.room_context_id;
    const roomPlayer = match.room_context_player_wallet?.toLowerCase() ?? null;
    if (!roomId || !roomPlayer) return;

    if (match.player_1?.toLowerCase() !== roomPlayer && match.player_2?.toLowerCase() !== roomPlayer) {
      return;
    }

    const opponentWallet =
      match.player_1?.toLowerCase() === roomPlayer ? match.player_2 : match.player_1;
    const winnerLower = winner?.toLowerCase() ?? null;

    const { data: room } = await (this.supabase
      .from('rooms')
      .select('room_id, status, matches_per_player') as any)
      .eq('room_id', roomId)
      .maybeSingle();

    if (!room || (room.status !== 'InProgress' && room.status !== 'Open')) return;

    const { data: member } = await this.supabase
      .from('room_members')
      .select('id, status')
      .eq('room_id', roomId)
      .eq('player_wallet', roomPlayer)
      .maybeSingle();

    if (!member || member.status !== 'Active') return;

    const { data: standing } = await this.supabase
      .from('room_standings')
      .select('*')
      .eq('room_id', roomId)
      .eq('player_wallet', roomPlayer)
      .maybeSingle();

    const baseWins = standing?.wins ?? 0;
    const baseLosses = standing?.losses ?? 0;
    const baseDraws = standing?.draws ?? 0;
    const basePoints = standing?.points ?? 0;

    let nextWins = baseWins;
    let nextLosses = baseLosses;
    let nextDraws = baseDraws;
    let nextPoints = basePoints;

    if (!winnerLower) {
      nextDraws += 1;
      nextPoints += 1;
    } else if (winnerLower === roomPlayer) {
      nextWins += 1;
      nextPoints += 3;
    } else {
      nextLosses += 1;
    }

    if (standing) {
      await this.supabase
        .from('room_standings')
        .update({
          wins: nextWins,
          losses: nextLosses,
          draws: nextDraws,
          points: nextPoints,
        })
        .eq('id', standing.id);
    } else {
      await this.supabase.from('room_standings').insert({
        room_id: roomId,
        player_wallet: roomPlayer,
        wins: nextWins,
        losses: nextLosses,
        draws: nextDraws,
        points: nextPoints,
      });
    }

    const gameNumber = nextWins + nextLosses + nextDraws;
    await this.supabase.from('room_fixtures').insert({
      room_id: roomId,
      round_number: gameNumber,
      player_a: roomPlayer,
      player_b: opponentWallet ?? null,
      match_id: match.match_id,
      status: 'Completed',
      winner_wallet: winner,
    });

    const { data: activeMembers } = await this.supabase
      .from('room_members')
      .select('player_wallet')
      .eq('room_id', roomId)
      .eq('status', 'Active');

    const { data: standings } = await this.supabase
      .from('room_standings')
      .select('player_wallet, wins, losses, draws')
      .eq('room_id', roomId);

    const playedByWallet = new Map<string, number>();
    for (const s of standings ?? []) {
      const key = s.player_wallet?.toLowerCase();
      if (!key) continue;
      playedByWallet.set(key, (s.wins ?? 0) + (s.losses ?? 0) + (s.draws ?? 0));
    }

    const targetMatches = (room as any).matches_per_player ?? 0;
    const roomComplete =
      (activeMembers ?? []).length > 0 &&
      (activeMembers ?? []).every((m) => {
        const key = m.player_wallet?.toLowerCase();
        if (!key) return false;
        return (playedByWallet.get(key) ?? 0) >= targetMatches;
      });

    if (roomComplete) {
      await this.completeRoom(roomId);
    }
  }

  private async completeRoom(roomId: number) {
    const { data: room } = await this.supabase
      .from('rooms')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();

    if (!room || room.status === 'Completed') return;

    // Determine winner from standings
    const { data: standings } = await this.supabase
      .from('room_standings')
      .select('*')
      .eq('room_id', roomId)
      .order('points', { ascending: false })
      .order('wins', { ascending: false });

    const winner = standings?.[0]?.player_wallet ?? null;
    const now = new Date();
    const destroyAfter = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const prizePool = BigInt((room as any).prize_pool ?? 0);
    const treasuryFee = (prizePool * BigInt(10)) / BigInt(100);
    const payout = prizePool - treasuryFee;

    if (winner) {
      await this.supabase
        .from('room_members')
        .update({ status: 'Winner', prize_won: Number(payout) } as any)
        .eq('room_id', roomId)
        .eq('player_wallet', winner);

      await this.supabase
        .from('room_members')
        .update({ status: 'Eliminated' } as any)
        .eq('room_id', roomId)
        .neq('player_wallet', winner)
        .neq('status', 'Quit');
    }

    await (this.supabase as any)
      .from('rooms')
      .update({
        status: 'Completed',
        ends_at: now.toISOString(),
        settled_at: now.toISOString(),
        destroy_after: destroyAfter.toISOString(),
        treasury_fee: treasuryFee.toString(),
        winner_payout: payout.toString(),
      })
      .eq('room_id', roomId);

    // NOTE: On-chain room settlement (settleRoomOnChain / cancelRoomOnChain)
    // is handled by the ccwg-web API routes or a separate cron job.
    // The WS server only marks the room complete in the DB.
    console.log(`[ROOM] Room ${roomId} marked Completed. Winner: ${winner ?? 'none'}`);
  }

  private async updateStarkPointsForMatch(match: MatchRow, winner: string | null) {
    if (!winner) return;

    const winnerLower = winner.toLowerCase();
    const p1 = match.player_1?.toLowerCase();
    const p2 = match.player_2?.toLowerCase();

    if (!p1 || !p2) return;

    if (match.mode === 'VsAI') {
      const aiWallet = '0x4149';
      const human = p1 === aiWallet ? p2 : p2 === aiWallet ? p1 : null;
      if (!human) return;

      const didWin = winnerLower === human;
      const { data: bot } = await this.supabase
        .from('bots')
        .select('difficulty')
        .eq('bot_id', match.bot_id ?? 0)
        .maybeSingle();

      const delta = this.getBotSpDelta(bot?.difficulty ?? null, didWin);
      if (delta === 0) return;

      await this.adjustStarkPoints(human, delta);
      return;
    }

    if (match.mode === 'Ranked1v1') {
      const loser = winnerLower === p1 ? p2 : p1;

      await Promise.all([
        this.adjustStarkPoints(winnerLower, 10),
        this.adjustStarkPoints(loser, -6),
      ]);
    }
  }

  /**
   * Returns event_participants rows that are eligible for leaderboard updates
   * from the given match.
   *
   * Guard rules (ALL must pass):
   *   1. Match mode must be Ranked1v1.
   *   2. Match must have a non-null event_context_id  this is set only when
   *      the match was initiated via the "Play Match" button on a specific
   *      tournament page.  Regular lobby ranked matches always have
   *      event_context_id = null and therefore never touch any event leaderboard.
   *   3. The event must currently be Open or InProgress.
   *   4. The event's total_rounds must match the match's total_rounds (prevents
   *      a mis-routed queue entry from polluting a different-format tournament).
   *   5. At least one match player must be registered in the event.
   *      This allows event-initiated queue to face regular ranked players while
   *      updating standings only for event participants.
   */
  private async getActiveEventParticipantsForMatch(match: MatchRow) {
    // Guard 1  only ranked matches can affect event standings
    if (match.mode !== 'Ranked1v1') return [];

    // Guard 2  event_context_id is null for all regular lobby ranked matches;
    //           only tournament-initiated matches carry a non-null value.
    if (!match.event_context_id) return [];

    const playerWalletSet = new Set(
      [match.player_1, match.player_2]
        .filter(Boolean)
        .map((wallet) => wallet.toLowerCase())
    );
    if (playerWalletSet.size === 0) return [];

    const { data } = await this.supabase
      .from('event_participants')
      .select(`
        id,
        event_id,
        player_wallet,
        war_points,
        total_wins,
        total_draws,
        total_losses,
        total_damage_done,
        total_damage_received,
        event:events!event_participants_event_id_fkey(status, total_rounds)
      `)
      .eq('event_id', match.event_context_id)   // only the specific tournament
      .returns<Array<{
        id: number;
        event_id: number;
        player_wallet: string;
        war_points: number | null;
        total_wins: number | null;
        total_draws: number | null;
        total_losses: number | null;
        total_damage_done: number | null;
        total_damage_received: number | null;
        event: { status: string | null; total_rounds: number } | null;
      }>>();

    // Guard 3 & 4  event must be active and rounds must match
    const activeParticipants = (data || []).filter((row) => {
      if (!row.event) return false;
      const status = row.event.status ?? '';
      const participantWallet = row.player_wallet?.toLowerCase() ?? '';
      return (
        playerWalletSet.has(participantWallet) &&
        (status === 'Open' || status === 'InProgress') &&
        row.event.total_rounds === match.total_rounds
      );
    });

    // Guard 5  at least one participant must be registered in this event
    if (activeParticipants.length < 1) return [];

    return activeParticipants;
  }

  private async updateEventDamageForRound(match: MatchRow, p1Damage: number, p2Damage: number) {
    if (match.mode !== 'Ranked1v1') return;

    const participants = await this.getActiveEventParticipantsForMatch(match);
    if (participants.length === 0) return;

    const p1Lower = match.player_1?.toLowerCase();
    const p2Lower = match.player_2?.toLowerCase();

    for (const row of participants) {
      const rowWallet = row.player_wallet?.toLowerCase();
      const isP1 = Boolean(p1Lower && rowWallet === p1Lower);
      const isP2 = Boolean(p2Lower && rowWallet === p2Lower);
      if (!isP1 && !isP2) continue;

      // p1Damage = damage P1 received (i.e. P2 dealt it)
      // p2Damage = damage P2 received (i.e. P1 dealt it)
      const damageDoneIncrement = isP1 ? p2Damage : p1Damage;
      const damageReceivedIncrement = isP1 ? p1Damage : p2Damage;

      await this.supabase
        .from('event_participants')
        .update({
          total_damage_done: (row.total_damage_done ?? 0) + damageDoneIncrement,
          total_damage_received: (row.total_damage_received ?? 0) + damageReceivedIncrement,
        })
        .eq('id', row.id);
    }
  }

  private async updateEventStandingsForMatch(match: MatchRow, winner: string | null) {
    if (match.mode !== 'Ranked1v1') return;

    const participants = await this.getActiveEventParticipantsForMatch(match);
    if (participants.length === 0) return;

    const winnerLower = winner?.toLowerCase() ?? null;

    for (const row of participants) {
      const rowWallet = row.player_wallet?.toLowerCase() ?? '';
      const didWin = Boolean(winnerLower && rowWallet === winnerLower);
      const didLose = Boolean(winnerLower && rowWallet !== winnerLower);
      const isDraw = !winner;

      const pointsDelta = didWin ? 3 : isDraw ? 1 : 0;

      await this.supabase
        .from('event_participants')
        .update({
          war_points: (row.war_points ?? 0) + pointsDelta,
          total_wins: (row.total_wins ?? 0) + (didWin ? 1 : 0),
          total_draws: (row.total_draws ?? 0) + (isDraw ? 1 : 0),
          total_losses: (row.total_losses ?? 0) + (didLose ? 1 : 0),
        })
        .eq('id', row.id);
    }
  }

  private getBotSpDelta(difficulty: string | null, didWin: boolean): number {
    if (!difficulty) return 0;
    const table: Record<string, number> = {
      Easy: 3,
      Medium: 5,
      Hard: 8,
    };
    const base = table[difficulty] ?? 0;
    return didWin ? base : -base;
  }

  private async adjustStarkPoints(wallet: string, delta: number) {
    if (!delta) return;
    const { data: player } = await this.supabase
      .from('players')
      .select('stark_points')
      .eq('wallet_address', wallet)
      .maybeSingle();

    if (!player) return;

    const current = player.stark_points ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;

    await this.supabase
      .from('players')
      .update({ stark_points: next })
      .eq('wallet_address', wallet);
  }

  private async fetchOraclePrices(
    matchId: number,
    roundNumber: number
  ): Promise<{ btc: string; eth: string; strk: string; sol: string; doge: string }> {
    const activeMatch = this.activeMatches.get(matchId);

    try {
      const [btcData, ethData, strkData, solData, dogeData] = await Promise.all([
        this.oracleSystem.getPriceForAsset(0),
        this.oracleSystem.getPriceForAsset(1),
        this.oracleSystem.getPriceForAsset(2),
        this.oracleSystem.getPriceForAsset(3),
        this.oracleSystem.getPriceForAsset(4),
      ]);

      const prices = {
        btc: this.formatPrice(btcData.price, btcData.decimals),
        eth: this.formatPrice(ethData.price, ethData.decimals),
        strk: this.formatPrice(strkData.price, strkData.decimals),
        sol: this.formatPrice(solData.price, solData.decimals),
        doge: this.formatPrice(dogeData.price, dogeData.decimals),
      };

      let previousPrices = activeMatch?.basePrices;

      if (!previousPrices && roundNumber === 1) {
        const { data: baseRound } = await this.supabase
          .from('match_rounds')
          .select('*')
          .eq('match_id', matchId)
          .eq('round_number', 0)
          .maybeSingle<MatchRoundsRow>();

        if (baseRound) {
          previousPrices = {
            btc: String(baseRound.btc_snapshot ?? '0'),
            eth: String(baseRound.eth_snapshot ?? '0'),
            strk: String(baseRound.strk_snapshot ?? '0'),
            sol: String(baseRound.sol_snapshot ?? '0'),
            doge: String(baseRound.doge_snapshot ?? '0'),
          };
        }
      }

      const { data: match } = await this.supabase
        .from('matches')
        .select('mode')
        .eq('match_id', matchId)
        .maybeSingle();

      const isVsAI = match?.mode === 'VsAI';

      if ((process.env.NODE_ENV === 'development' || isVsAI) && previousPrices) {
        const adjustIfFlat = (key: keyof typeof prices) => {
          const prev = Number.parseFloat(previousPrices[key]);
          const curr = Number.parseFloat(prices[key]);

          if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev <= 0) {
            console.warn(`[ORACLE] Invalid prices for ${key}: prev=${prev}, curr=${curr}`);
            return;
          }

          const percentChange = Math.abs((curr - prev) / prev);
          if (percentChange < 0.0001) {
            const sign = Math.random() < 0.5 ? -1 : 1;
            const variance = 0.0008 + Math.random() * 0.0004;
            const newPrice = curr * (1 + sign * variance);
            prices[key] = newPrice.toFixed(8);
          }
        };

        adjustIfFlat('btc');
        adjustIfFlat('eth');
        adjustIfFlat('strk');
        adjustIfFlat('sol');
        adjustIfFlat('doge');
      }

      if (activeMatch) {
        activeMatch.basePrices = prices;
      }

      await this.storeOracleSnapshot(matchId, roundNumber, prices);
      return prices;
    } catch (error) {
      console.error('[ORACLE] Failed to fetch prices:', error);

      if (activeMatch?.basePrices) {
        console.warn('[ORACLE] Using last known prices as fallback');
        return activeMatch.basePrices;
      }

      console.warn('[ORACLE] Using mock prices, oracle unavailable');
      return this.getMockPrices();
    }
  }

  private getBotWeights(botStyle: { aggression: number; defense: number; charge_bias: number } | null) {
    const aggression = botStyle?.aggression ?? 50;
    const defense = botStyle?.defense ?? 50;
    const charge = botStyle?.charge_bias ?? 25;

    const total = Math.max(1, aggression + defense + charge);
    const attackWeight = aggression / total;
    const defenseWeight = defense / total;
    const chargeWeight = charge / total;
    const baseWeight = (attackWeight + defenseWeight + chargeWeight) / 3;

    return {
      attack: attackWeight,
      defense: defenseWeight,
      charge: chargeWeight,
      base: baseWeight,
    };
  }

  private formatPrice(price: bigint, decimals: number): string {
    const priceStr = price.toString();
    if (decimals <= 0) return priceStr;

    if (priceStr.length <= decimals) {
      return '0.' + priceStr.padStart(decimals, '0');
    }

    const whole = priceStr.slice(0, -decimals);
    const decimal = priceStr.slice(-decimals);
    return whole + '.' + decimal;
  }

  private async storeOracleSnapshot(
    matchId: number,
    roundNumber: number,
    prices: { btc: string; eth: string; strk: string; sol: string; doge: string }
  ) {
    try {
      const now = new Date().toISOString();

      const snapshots: OracleSnapshotsInsert[] = [
        { match_id: matchId, round_number: roundNumber, asset: 'BTC', price: Number.parseFloat(prices.btc), decimals: 8, timestamp: now },
        { match_id: matchId, round_number: roundNumber, asset: 'ETH', price: Number.parseFloat(prices.eth), decimals: 8, timestamp: now },
        { match_id: matchId, round_number: roundNumber, asset: 'STRK', price: Number.parseFloat(prices.strk), decimals: 8, timestamp: now },
        { match_id: matchId, round_number: roundNumber, asset: 'SOL', price: Number.parseFloat(prices.sol), decimals: 8, timestamp: now },
        { match_id: matchId, round_number: roundNumber, asset: 'DOGE', price: Number.parseFloat(prices.doge), decimals: 8, timestamp: now },
      ];

      await this.supabase.from('oracle_snapshots').insert(snapshots);
    } catch (error) {
      console.error('[ORACLE] Failed to store snapshots:', error);
    }
  }

  private getMockPrices(): { btc: string; eth: string; strk: string; sol: string; doge: string } {
    const basePrices = {
      btc: '67072.47',
      eth: '1941.85',
      strk: '0.04999',
      sol: '82.57',
      doge: '0.09415',
    };

    const variance = 0.02;
    const randomize = (base: string) => {
      const baseNum = Number.parseFloat(base);
      const change = baseNum * variance * (Math.random() * 2 - 1);
      return (baseNum + change).toFixed(8);
    };

    return {
      btc: randomize(basePrices.btc),
      eth: randomize(basePrices.eth),
      strk: randomize(basePrices.strk),
      sol: randomize(basePrices.sol),
      doge: randomize(basePrices.doge),
    };
  }

  private async buildOpponentCardSelectedPayload(
    matchId: number,
    roundNumber: number,
    opponentWallet: string,
    isBotOpponent: boolean,
    fallbackAsset: CardAsset | null
  ): Promise<{
    match_id: number;
    round_number: number;
    opponent_wallet: string;
    card_asset: CardAsset;
    card: PlayerCardWithFullTemplate | BotCardWithTemplate | null;
  } | null> {
    const { data: matchPlayer, error: matchPlayerError } = await this.supabase
      .from('match_players')
      .select('active_card_id, bot_active_card_id')
      .eq('match_id', matchId)
      .eq('player_wallet', opponentWallet)
      .maybeSingle<Pick<MatchPlayersRow, 'active_card_id' | 'bot_active_card_id'>>();

    if (matchPlayerError) {
      console.error('[STATE SYNC] Failed to fetch match_players row for opponent card replay:', {
        matchId,
        opponentWallet,
        error: matchPlayerError,
      });
    }

    const activeCardId = isBotOpponent ? matchPlayer?.bot_active_card_id : matchPlayer?.active_card_id;

    let cardAsset: CardAsset | null = fallbackAsset;
    let card: PlayerCardWithFullTemplate | BotCardWithTemplate | null = null;

    if (activeCardId) {
      if (isBotOpponent) {
        const { data: botCard, error: botCardError } = await this.supabase
          .from('bot_cards')
          .select('id, template_id, level, merge_count, created_at, updated_at, template:card_templates(*)')
          .eq('id', activeCardId)
          .maybeSingle<BotCardWithTemplate>();

        if (botCardError) {
          console.error('[STATE SYNC] Failed to fetch bot card for opponent replay:', {
            matchId,
            opponentWallet,
            activeCardId,
            error: botCardError,
          });
        }

        if (botCard) {
          card = botCard;
          cardAsset = botCard.template?.asset ?? cardAsset;
          if (!cardAsset) {
            const { data: templateRow } = await this.supabase
              .from('card_templates')
              .select('asset')
              .eq('template_id', botCard.template_id)
              .maybeSingle<{ asset: CardAsset }>();
            cardAsset = templateRow?.asset ?? null;
          }
        }
      } else {
        const { data: playerCard, error: playerCardError } = await this.supabase
          .from('player_cards')
          .select('id, owner_wallet, template_id, level, merge_count, acquired_at, template:card_templates(*)')
          .eq('id', activeCardId)
          .maybeSingle<PlayerCardWithFullTemplate>();

        if (playerCardError) {
          console.error('[STATE SYNC] Failed to fetch player card for opponent replay:', {
            matchId,
            opponentWallet,
            activeCardId,
            error: playerCardError,
          });
        }

        if (playerCard) {
          card = playerCard;
          cardAsset = playerCard.template?.asset ?? cardAsset;
          if (!cardAsset) {
            const { data: templateRow } = await this.supabase
              .from('card_templates')
              .select('asset')
              .eq('template_id', playerCard.template_id)
              .maybeSingle<{ asset: CardAsset }>();
            cardAsset = templateRow?.asset ?? null;
          }
        }
      }
    }

    if (!cardAsset) {
      return null;
    }

    return {
      match_id: matchId,
      round_number: roundNumber,
      opponent_wallet: opponentWallet,
      card_asset: cardAsset,
      card,
    };
  }

  private async replayOpponentCardState(
    match: MatchesRow,
    roundNumber: number,
    playerWallet: string,
    ws: WebSocket
  ) {
    const opponentWallet = playerWallet === match.player_1 ? match.player_2 : match.player_1;
    if (!opponentWallet) return;

    const activeMatch = this.activeMatches.get(match.match_id);
    const fallbackAsset = activeMatch?.currentRoundCards.get(opponentWallet) ?? null;
    const isBotOpponent = match.mode === 'VsAI' && opponentWallet === match.player_2;

    const payload = await this.buildOpponentCardSelectedPayload(
      match.match_id,
      roundNumber,
      opponentWallet,
      isBotOpponent,
      fallbackAsset
    );

    if (!payload) return;

    if (activeMatch) {
      activeMatch.currentRoundCards.set(opponentWallet, payload.card_asset);
    }

    this.sendMessage(ws, {
      type: 'opponent_card_selected',
      payload,
    });
  }

  private async sendMatchState(matchId: number, ws: WebSocket, playerWallet: string) {
    const { data: match } = await this.supabase
      .from('matches')
      .select('*')
      .eq('match_id', matchId)
      .single<MatchesRow>();

    if (!match) return;

    const { data: currentRound } = await this.supabase
      .from('match_rounds')
      .select('*')
      .eq('match_id', matchId)
      .eq('round_number', match.current_round ?? 1)
      .single<MatchRoundsRow>();

    if (!currentRound) {
      await this.ensureBaselineSnapshot(matchId);
      await this.startRound(matchId, match.current_round ?? 1);
      return;
    }

    const activeMatch = this.activeMatches.get(matchId);

    const opponent = playerWallet === match.player_1 ? match.player_2 : match.player_1;
    const roundNumber = match.current_round ?? 1;
    const cloakActive =
      Boolean(opponent) &&
      (activeMatch?.cloakUntilRoundByWallet.get(opponent) ?? 0) >= roundNumber;
    const disableCharge =
      (activeMatch?.disableChargeUntilRoundByWallet.get(playerWallet) ?? 0) >= roundNumber;
    const disableSwap =
      (activeMatch?.disableSwapUntilRoundByWallet.get(playerWallet) ?? 0) >= roundNumber;

    const message: RoundStartMessage = {
      type: 'round_start',
      payload: {
        match_id: matchId,
        round_number: roundNumber,
        round_end_timestamp:
          match.mode === 'VsAI'
            ? 0
            : activeMatch?.roundEndTimestamp || Date.now() + ROUND_DURATION_MS,
        first_mover_wallet: activeMatch?.firstMoverWallet || null,
        btc_price: String(currentRound.btc_snapshot || '0'),
        eth_price: String(currentRound.eth_snapshot || '0'),
        strk_price: String(currentRound.strk_snapshot || '0'),
        sol_price: String(currentRound.sol_snapshot || '0'),
        doge_price: String(currentRound.doge_snapshot || '0'),
        disable_charge: disableCharge,
        disable_swap: disableSwap,
        cloak_active: cloakActive,
      },
    };

    this.sendMessage(ws, message);
    await this.replayOpponentCardState(match, roundNumber, playerWallet, ws);
  }

  private getOpponent(playerWallet: string, activeMatch: ActiveMatch, matchId: number): string | null {
    for (const wallet of activeMatch.players.keys()) {
      if (wallet !== playerWallet) return wallet;
    }

    this.supabase
      .from('matches')
      .select('player_1, player_2')
      .eq('match_id', matchId)
      .single<Pick<MatchesRow, 'player_1' | 'player_2'>>()
      .then(({ data: match }) => {
        if (match) {
          return playerWallet === match.player_1 ? match.player_2 : match.player_1;
        }
      });

    return null;
  }

  private broadcastToMatch(matchId: number, message: unknown) {
    const activeMatch = this.activeMatches.get(matchId);
    if (!activeMatch) return;

    for (const ws of activeMatch.players.values()) {
      this.sendMessage(ws, message);
    }
  }

  private sendMessage(ws: WebSocket, message: unknown) {
    safeSend(ws, message);
  }

  private sendError(ws: WebSocket, message: string) {
    this.sendMessage(ws, { type: 'error', payload: { message } });
  }
}
