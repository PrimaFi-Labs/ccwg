// ccwg-server/src/lit-trader-ai-engine.ts
// ============================================================================
// Lit Trader — A cautious, risk-averse bot that prefers stability over volatility
// Favourite coin: BTC. Personality: careful, measured, avoids gambling.
// Not as strong as E.V.E — uses simpler pattern matching, no deep opponent modelling.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlayerAction } from '@ccwg/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MatchRow = {
  match_id: number;
  player_1: string;
  player_2: string | null;
  p1_rounds_won: number;
  p2_rounds_won: number;
  total_rounds: number;
  current_round: number;
  mode: string;
};

type MatchActionRow = {
  action: PlayerAction;
  round_number: number;
};

type CardTemplateRow = {
  template_id: number;
  asset: string;
  name: string;
  base: number;
  attack_affinity: number;
  defense_affinity: number;
  charge_affinity: number | null;
  volatility_sensitivity: number;
  ability_id: string | null;
};

type AIActionCallback = (args: {
  matchId: number;
  roundNumber: number;
  playerWallet: string;
  action: PlayerAction;
  clientNonce: string;
}) => Promise<void>;

// ---------------------------------------------------------------------------
// Lit Trader AI Engine
// ---------------------------------------------------------------------------

function safeNonce(prefix: string) {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

export class LitTraderAIEngine {
  private supabase: SupabaseClient;
  private timers = new Set<NodeJS.Timeout>();
  private onAction: AIActionCallback | null;

  // Track own action history per match
  private actionHistory = new Map<number, PlayerAction[]>();

  constructor(supabase: SupabaseClient, onAction?: AIActionCallback) {
    this.supabase = supabase;
    this.onAction = onAction || null;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  async submitAIAction(
    matchId: number,
    roundNumber: number,
    aiWallet: string,
    forceImmediate = false
  ) {
    // Lit Trader takes his time — a measured, slow decision maker
    const baseDelay = forceImmediate ? 200 + Math.random() * 400 : 1500 + Math.random() * 1500;

    console.log(
      `[LIT TRADER] Scheduling action for match ${matchId} round ${roundNumber} ` +
        `(delay: ${baseDelay.toFixed(0)}ms)`
    );

    const timer = setTimeout(() => {
      void this.runAIAction(matchId, roundNumber, aiWallet);
    }, baseDelay);

    this.timers.add(timer);
    timer.unref?.();
  }

  stopAllTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  cleanupMatch(matchId: number) {
    this.actionHistory.delete(matchId);
  }

  // =========================================================================
  // Core Decision Loop
  // =========================================================================

  private async runAIAction(
    matchId: number,
    roundNumber: number,
    aiWallet: string
  ) {
    try {
      console.log(`[LIT TRADER] === Round ${roundNumber} Decision ===`);

      const match = await this.getMatchState(matchId);
      if (!match) {
        console.error(`[LIT TRADER] Cannot find match ${matchId}`);
        return;
      }

      // Fetch opponent's recent actions (simple pattern recognition, not deep modelling)
      const opponentWallet = match.player_1 === aiWallet ? match.player_2 : match.player_1;
      const { data: opponentActions } = await this.supabase
        .from('match_actions')
        .select('action, round_number')
        .eq('match_id', matchId)
        .eq('player_wallet', opponentWallet)
        .order('round_number', { ascending: false })
        .limit(3)
        .returns<MatchActionRow[]>();

      const recentOpponentActions = opponentActions ?? [];
      const history = this.actionHistory.get(matchId) || [];

      let action = this.selectCautiousAction(match, roundNumber, recentOpponentActions, history, aiWallet);
      console.log(`[LIT TRADER] Selected action: ${action}`);

      // Validate Charge
      if (action === 'Charge') {
        const canCharge = await this.validateCharge(matchId, roundNumber, aiWallet);
        if (!canCharge) {
          console.log(`[LIT TRADER] Charge unavailable, falling back to Defend`);
          action = 'Defend';
        }
      }

      // Track our own action
      history.push(action);
      this.actionHistory.set(matchId, history);

      console.log(`[LIT TRADER] === Final decision: ${action} ===`);

      const nonce = safeNonce('lit');
      if (this.onAction) {
        await this.onAction({
          matchId,
          roundNumber,
          playerWallet: aiWallet,
          action,
          clientNonce: nonce,
        });
        return;
      }

      // Fallback: direct DB insert
      const { data: matchPlayer } = await this.supabase
        .from('match_players')
        .select('bot_active_card_id')
        .eq('match_id', matchId)
        .eq('player_wallet', aiWallet)
        .single();

      if (!matchPlayer?.bot_active_card_id) return;

      await this.supabase.from('match_actions').insert({
        match_id: matchId,
        round_number: roundNumber,
        player_wallet: aiWallet,
        action,
        bot_card_id: matchPlayer.bot_active_card_id,
        client_nonce: nonce,
      });
    } catch (err) {
      console.error('[LIT TRADER] runAIAction error:', err);
    }
  }

  // =========================================================================
  // Cautious Strategy — Lit Trader's personality
  //
  // Core traits:
  // - Strongly prefers Defend (~55% base rate)
  // - Attacks only when safe or when leading
  // - Rarely charges — doesn't like gambling
  // - Avoids volatile/risky plays
  // - Only gets aggressive when significantly behind
  // =========================================================================

  private selectCautiousAction(
    match: MatchRow,
    roundNumber: number,
    recentOpponentActions: MatchActionRow[],
    ownHistory: PlayerAction[],
    aiWallet: string
  ): PlayerAction {
    const roundsToWin = Math.floor(match.total_rounds / 2) + 1;
    const isP2 = match.player_2 === aiWallet;
    const myWins = isP2 ? match.p2_rounds_won : match.p1_rounds_won;
    const oppWins = isP2 ? match.p1_rounds_won : match.p2_rounds_won;
    const chargeUsed = ownHistory.includes('Charge');

    // Round 1: Always defend — Lit Trader never makes the first aggressive move
    if (roundNumber === 1) {
      console.log(`[LIT TRADER] Round 1: Safe start with Defend`);
      return 'Defend';
    }

    // Simple opponent pattern detection (last 2-3 actions)
    const lastOpAction = recentOpponentActions.length > 0 ? recentOpponentActions[0].action : null;
    const prevOpAction = recentOpponentActions.length > 1 ? recentOpponentActions[1].action : null;

    // Opponent attacking repeatedly — turtle up
    if (lastOpAction === 'Attack' && prevOpAction === 'Attack') {
      console.log(`[LIT TRADER] Opponent attacking streak — playing safe`);
      return 'Defend';
    }

    // Opponent defending repeatedly — safe to poke with Attack
    if (lastOpAction === 'Defend' && prevOpAction === 'Defend') {
      console.log(`[LIT TRADER] Opponent defending — cautious counter`);
      return Math.random() < 0.65 ? 'Attack' : 'Defend';
    }

    // If leading: play very safe, protect the lead
    if (myWins > oppWins) {
      console.log(`[LIT TRADER] Leading ${myWins}-${oppWins}, protecting lead`);
      const rand = Math.random();
      if (rand < 0.60) return 'Defend';
      if (rand < 0.90) return 'Attack';
      // Very small chance to charge if not used, to not be fully predictable
      return !chargeUsed ? 'Charge' : 'Defend';
    }

    // If significantly behind: reluctantly become slightly more aggressive
    if (oppWins >= roundsToWin - 1 && myWins < oppWins) {
      console.log(`[LIT TRADER] Opponent close to winning — forced aggression`);
      const rand = Math.random();
      if (rand < 0.45) return 'Attack';
      if (rand < 0.80) return 'Defend';
      return !chargeUsed ? 'Charge' : 'Attack';
    }

    // If tied or slightly behind: balanced cautious play
    // Counter the opponent's last action conservatively
    if (lastOpAction === 'Attack') {
      return Math.random() < 0.70 ? 'Defend' : 'Attack';
    }
    if (lastOpAction === 'Charge') {
      // Opponent just charged — they sacrificed offense, safe to Attack
      return Math.random() < 0.60 ? 'Attack' : 'Defend';
    }

    // Default: Mostly defend with occasional attacks
    // Avoid 3+ consecutive same action to not be fully predictable
    if (ownHistory.length >= 2) {
      const last2 = ownHistory.slice(-2);
      if (last2[0] === last2[1] && last2[1] === 'Defend') {
        console.log(`[LIT TRADER] Breaking defend streak`);
        return 'Attack';
      }
    }

    const rand = Math.random();
    if (rand < 0.55) return 'Defend';
    if (rand < 0.90) return 'Attack';
    return !chargeUsed ? 'Charge' : 'Defend';
  }

  // =========================================================================
  // Deck Building — Prefers BTC, avoids high-volatility cards
  // =========================================================================

  async buildDeck(
    matchId: number,
    aiWallet: string
  ): Promise<{ cardIds: number[]; activeCardId: number } | null> {
    try {
      console.log(`[LIT TRADER DECK] Building deck for match ${matchId}`);

      // Check if already has a deck
      const { data: existing } = await this.supabase
        .from('match_players')
        .select('bot_card_1_id, bot_card_2_id, bot_card_3_id')
        .eq('match_id', matchId)
        .eq('player_wallet', aiWallet)
        .maybeSingle();

      if (existing?.bot_card_1_id && existing?.bot_card_2_id && existing?.bot_card_3_id) {
        return {
          cardIds: [existing.bot_card_1_id, existing.bot_card_2_id, existing.bot_card_3_id],
          activeCardId: existing.bot_card_1_id,
        };
      }

      // Fetch AI-enabled templates
      const { data: allTemplates } = await this.supabase
        .from('card_templates')
        .select(
          'template_id, asset, name, base, attack_affinity, defense_affinity, charge_affinity, volatility_sensitivity, ability_id'
        )
        .eq('is_ai_card', true)
        .returns<CardTemplateRow[]>();

      let templates = allTemplates ?? [];

      if (templates.length < 3) {
        const { data: fallback } = await this.supabase
          .from('card_templates')
          .select(
            'template_id, asset, name, base, attack_affinity, defense_affinity, charge_affinity, volatility_sensitivity, ability_id'
          )
          .returns<CardTemplateRow[]>();
        templates = fallback ?? [];
      }

      if (templates.length < 3) {
        console.error('[LIT TRADER DECK] Not enough templates');
        return null;
      }

      // Score templates: BTC strongly preferred, low volatility preferred, defense valued
      const scored = templates.map((t) => {
        const basePower = t.base;
        let score = 0;

        // Lit Trader loves BTC — big preference bonus
        if (t.asset === 'BTC') score += 25;

        // High defense affinity is highly valued
        score += t.defense_affinity * 30;

        // Moderate attack value
        score += t.attack_affinity * 15;

        // Base power matters
        score += basePower * 0.25;

        // LOW volatility sensitivity is preferred — Lit Trader dislikes volatility
        // Penalize high volatility sensitivity
        score -= Math.abs(t.volatility_sensitivity - 0.8) * 10;

        // Small charge affinity value (rarely charges)
        score += (t.charge_affinity ?? 0) * 5;

        return { template: t, score };
      });

      // Sort by score and pick top 3
      scored.sort((a, b) => b.score - a.score);
      const picks = scored.slice(0, 3).map((s) => s.template);

      return this.assignDeck(matchId, aiWallet, picks);
    } catch (err) {
      console.error('[LIT TRADER DECK] Error building deck:', err);
      return null;
    }
  }

  // =========================================================================
  // Per-Round Card Selection — Always prefers BTC when available
  // =========================================================================

  async selectCardForRound(
    matchId: number,
    aiWallet: string,
    roundNumber: number
  ): Promise<{
    nextCardId: number;
    cardAsset: string | null;
    cardData: unknown;
  } | null> {
    try {
      const { data: mp } = await this.supabase
        .from('match_players')
        .select('bot_card_1_id, bot_card_2_id, bot_card_3_id, bot_active_card_id')
        .eq('match_id', matchId)
        .eq('player_wallet', aiWallet)
        .maybeSingle();

      if (!mp) return null;
      const options = [mp.bot_card_1_id, mp.bot_card_2_id, mp.bot_card_3_id].filter(
        Boolean
      ) as number[];
      if (options.length === 0) return null;

      // Fetch full card data
      const { data: deckCards } = await this.supabase
        .from('bot_cards')
        .select(
          'id, template_id, template:card_templates(template_id, asset, name, base, attack_affinity, defense_affinity, charge_affinity, volatility_sensitivity, ability_id)'
        )
        .in('id', options);

      if (!deckCards || deckCards.length === 0) {
        return { nextCardId: options[0], cardAsset: null, cardData: null };
      }

      // Lit Trader strongly favours BTC, then picks highest defense card
      const cardScores = deckCards
        .filter((c) => c.template)
        .map((c) => {
          const t = c.template as unknown as {
            template_id: number;
            asset: string;
            name: string;
            base: number;
            attack_affinity: number;
            defense_affinity: number;
            charge_affinity: number;
            volatility_sensitivity: number;
            ability_id: string | null;
          };

          let score = 0;
          const basePower = t.base;

          // BTC is always preferred
          if (t.asset === 'BTC') score += 30;

          // Defense-oriented scoring (Lit Trader plays defensively)
          score += t.defense_affinity * 25;
          score += basePower * 0.3;
          score += t.attack_affinity * 10;

          // Penalize high volatility — doesn't like volatile periods
          score -= Math.abs(t.volatility_sensitivity - 0.8) * 8;

          // Tiny randomization
          score += Math.random() * 1.5;

          return { id: c.id as number, score, template: t };
        });

      cardScores.sort((a, b) => b.score - a.score);
      const nextCardId = cardScores[0]?.id ?? options[0];

      await this.supabase
        .from('match_players')
        .update({ bot_active_card_id: nextCardId })
        .eq('match_id', matchId)
        .eq('player_wallet', aiWallet);

      const selectedCard = cardScores[0];
      console.log(
        `[LIT TRADER CARD] Round ${roundNumber}: Selected ${selectedCard?.template?.name ?? 'unknown'} ` +
          `(${selectedCard?.template?.asset ?? '?'}) — Score: ${selectedCard?.score?.toFixed(1) ?? '?'}`
      );

      return {
        nextCardId,
        cardAsset: selectedCard?.template?.asset ?? null,
        cardData: deckCards.find((c) => (c.id as number) === nextCardId) ?? null,
      };
    } catch (err) {
      console.error('[LIT TRADER CARD] Error selecting card:', err);
      return null;
    }
  }

  // =========================================================================
  // Utility Functions
  // =========================================================================

  private async getMatchState(matchId: number): Promise<MatchRow | null> {
    const { data, error } = await this.supabase
      .from('matches')
      .select('player_1, player_2, p1_rounds_won, p2_rounds_won, total_rounds, current_round, mode')
      .eq('match_id', matchId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      player_1: data.player_1,
      player_2: data.player_2,
      p1_rounds_won: data.p1_rounds_won,
      p2_rounds_won: data.p2_rounds_won,
      total_rounds: data.total_rounds,
      current_round: data.current_round,
      mode: data.mode,
      match_id: matchId,
    } as MatchRow;
  }

  private async validateCharge(
    matchId: number,
    roundNumber: number,
    aiWallet: string
  ): Promise<boolean> {
    const { data: chargeUsedRow } = await this.supabase
      .from('match_players')
      .select('charge_used')
      .eq('match_id', matchId)
      .eq('player_wallet', aiWallet)
      .maybeSingle();

    if (chargeUsedRow?.charge_used) return false;

    const { data: chargeRow } = await this.supabase
      .from('match_actions')
      .select('id')
      .eq('match_id', matchId)
      .eq('round_number', roundNumber)
      .eq('action', 'Charge')
      .maybeSingle();

    return !chargeRow;
  }

  private async assignDeck(
    matchId: number,
    aiWallet: string,
    templates: CardTemplateRow[]
  ): Promise<{ cardIds: number[]; activeCardId: number } | null> {
    const templateIds = templates.map((t) => t.template_id);

    await this.supabase
      .from('bot_cards')
      .upsert(
        templateIds.map((id) => ({ template_id: id })),
        { onConflict: 'template_id' }
      );

    const { data: botCards } = await this.supabase
      .from('bot_cards')
      .select('id, template_id')
      .in('template_id', templateIds);

    if (!botCards || botCards.length < 3) {
      console.error('[LIT TRADER DECK] Could not create bot cards');
      return null;
    }

    const templateToBotCard = new Map(botCards.map((bc) => [bc.template_id, bc.id as number]));
    const cardIds = templateIds.map((tid) => templateToBotCard.get(tid)!).filter(Boolean);

    if (cardIds.length < 3) {
      console.error('[LIT TRADER DECK] Card ID mapping incomplete');
      return null;
    }

    // Pick BTC card as active if available, otherwise highest defense
    const activeTemplate = templates.find((t) => t.asset === 'BTC') ||
      templates.reduce((best, t) => (t.defense_affinity > best.defense_affinity ? t : best));
    const activeCardId = templateToBotCard.get(activeTemplate.template_id) ?? cardIds[0];

    const updateData = {
      bot_card_1_id: cardIds[0],
      bot_card_2_id: cardIds[1],
      bot_card_3_id: cardIds[2],
      bot_active_card_id: activeCardId,
    };

    const { error } = await this.supabase
      .from('match_players')
      .update(updateData)
      .eq('match_id', matchId)
      .eq('player_wallet', aiWallet);

    if (error) {
      console.error('[LIT TRADER DECK] Failed to assign deck:', error);
      return null;
    }

    console.log(
      `[LIT TRADER DECK] Assigned deck: [${cardIds.join(', ')}] — ` +
        `Active: ${activeCardId} (${activeTemplate.name} ${activeTemplate.asset})`
    );

    return { cardIds: cardIds.slice(0, 3), activeCardId };
  }
}
