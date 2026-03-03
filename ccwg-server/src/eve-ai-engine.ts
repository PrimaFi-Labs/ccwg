// ccwg-web/server/eve-ai-engine.ts
// ============================================================================
// E.V.E — Enhanced Virtual Entity
// A superintelligent adaptive AI opponent for CCWG
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
  card_id: number | null;
  bot_card_id: number | null;
};

type MatchRoundRow = {
  winner: string | null;
  round_number: number;
  p1_action: PlayerAction | null;
  p2_action: PlayerAction | null;
};

type CardTemplateRow = {
  template_id: number;
  asset: string;
  name: string;
  base: number;
  base_power: number | null;
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

export type BotProfileRow = {
  bot_id: number;
  name: string;
  difficulty: string;
  aggression: number | null;
  defense: number | null;
  charge_bias: number | null;
};

// ---------------------------------------------------------------------------
// Opponent Model — tracks patterns, tendencies, and predicts behaviour
// ---------------------------------------------------------------------------

interface OpponentModel {
  /** Sliding window of last N actions */
  actionHistory: PlayerAction[];
  /** Bigram frequencies: maps "Attack->Defend" to count */
  bigramCounts: Map<string, number>;
  /** Trigram frequencies */
  trigramCounts: Map<string, number>;
  /** Per-action frequency */
  actionFrequency: Record<PlayerAction, number>;
  /** Tracks how opponent reacts to EVE's actions */
  reactionMap: Map<string, Record<PlayerAction, number>>;
  /** Consecutive same-action streak */
  currentStreak: { action: PlayerAction | null; count: number };
  /** Whether opponent tends to charge early or late */
  chargeRoundPreference: number[];
  /** Whether opponent has used their charge */
  chargeUsed: boolean;
  /** Rounds the opponent won */
  roundsWon: number;
  /** Opponent's detected play style */
  detectedStyle: 'aggressive' | 'defensive' | 'balanced' | 'chaotic' | 'unknown';
  /** Confidence in style detection (0-1) */
  styleConfidence: number;
}

// ---------------------------------------------------------------------------
// E.V.E AI Engine
// ---------------------------------------------------------------------------

function safeNonce(prefix: string) {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

export class EVEAIEngine {
  private supabase: SupabaseClient;
  private timers = new Set<NodeJS.Timeout>();
  private onAction: AIActionCallback | null;

  // Per-match opponent models (keyed by matchId)
  private opponentModels = new Map<number, OpponentModel>();

  // E.V.E's own action history per match
  private eveActionHistory = new Map<number, PlayerAction[]>();

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
    // E.V.E reacts fast — 0.5-1.2s base, but appears to "think" more on critical rounds
    const match = await this.getMatchState(matchId);
    const criticality = match ? this.assessCriticality(match, roundNumber) : 0.5;
    const baseDelay = forceImmediate ? 100 + Math.random() * 200 : 500 + Math.random() * 700;
    const delay = baseDelay + criticality * 800; // Up to 1.3s extra on critical rounds

    console.log(
      `[E.V.E] Scheduling action for match ${matchId} round ${roundNumber} ` +
        `(delay: ${delay.toFixed(0)}ms, criticality: ${criticality.toFixed(2)})`
    );

    const timer = setTimeout(() => {
      void this.runAIAction(matchId, roundNumber, aiWallet);
    }, delay);

    this.timers.add(timer);
    timer.unref?.();
  }

  stopAllTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  cleanupMatch(matchId: number) {
    this.opponentModels.delete(matchId);
    this.eveActionHistory.delete(matchId);
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
      console.log(`[E.V.E] === Round ${roundNumber} Decision Process ===`);

      // Build/update opponent model
      const model = await this.buildOpponentModel(matchId, aiWallet);
      const match = await this.getMatchState(matchId);
      if (!match) {
        console.error(`[E.V.E] Cannot find match ${matchId}`);
        return;
      }

      // Detect opponent style
      this.detectOpponentStyle(model);
      console.log(
        `[E.V.E] Opponent style: ${model.detectedStyle} (confidence: ${model.styleConfidence.toFixed(2)})`
      );

      // Predict opponent's next action using multi-layer prediction
      const prediction = this.predictOpponentAction(model, match, roundNumber);
      console.log(
        `[E.V.E] Prediction: ${JSON.stringify(prediction)}`
      );

      // Determine EVE's optimal response
      let action = this.selectOptimalAction(prediction, model, match, roundNumber, aiWallet);
      console.log(`[E.V.E] Initial action selection: ${action}`);

      // Apply meta-game adjustments
      action = this.applyMetaGameAdjustments(action, model, match, roundNumber, aiWallet);
      console.log(`[E.V.E] After meta-game adjustments: ${action}`);

      // Validate Charge
      if (action === 'Charge') {
        const canCharge = await this.validateCharge(matchId, roundNumber, aiWallet);
        if (!canCharge) {
          console.log(`[E.V.E] Charge unavailable, falling back`);
          action = this.getChargeFallback(prediction);
        }
      }

      console.log(`[E.V.E] === Final decision: ${action} ===`);

      // Track our own action
      const history = this.eveActionHistory.get(matchId) || [];
      history.push(action);
      this.eveActionHistory.set(matchId, history);

      // Submit
      const nonce = safeNonce('eve');
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
      console.error('[E.V.E] runAIAction error:', err);
    }
  }

  // =========================================================================
  // Opponent Modelling
  // =========================================================================

  private async buildOpponentModel(
    matchId: number,
    aiWallet: string
  ): Promise<OpponentModel> {
    let model = this.opponentModels.get(matchId);
    if (!model) {
      model = {
        actionHistory: [],
        bigramCounts: new Map(),
        trigramCounts: new Map(),
        actionFrequency: { Attack: 0, Defend: 0, Charge: 0, NoAction: 0 },
        reactionMap: new Map(),
        currentStreak: { action: null, count: 0 },
        chargeRoundPreference: [],
        chargeUsed: false,
        roundsWon: 0,
        detectedStyle: 'unknown',
        styleConfidence: 0,
      };
    }

    // Fetch match data
    const { data: match } = await this.supabase
      .from('matches')
      .select('player_1, player_2')
      .eq('match_id', matchId)
      .maybeSingle();

    if (!match) return model;

    const opponentWallet = match.player_1 === aiWallet ? match.player_2 : match.player_1;

    // Get ALL opponent actions (ordered by round)
    const { data: opponentActions } = await this.supabase
      .from('match_actions')
      .select('action, round_number, card_id, bot_card_id')
      .eq('match_id', matchId)
      .eq('player_wallet', opponentWallet)
      .order('round_number', { ascending: true })
      .returns<MatchActionRow[]>();

    // Get E.V.E's own actions for reaction analysis
    const { data: eveActions } = await this.supabase
      .from('match_actions')
      .select('action, round_number, card_id, bot_card_id')
      .eq('match_id', matchId)
      .eq('player_wallet', aiWallet)
      .order('round_number', { ascending: true })
      .returns<MatchActionRow[]>();

    // Get round results
    const { data: rounds } = await this.supabase
      .from('match_rounds')
      .select('winner, round_number, p1_action, p2_action')
      .eq('match_id', matchId)
      .order('round_number', { ascending: true })
      .returns<MatchRoundRow[]>();

    const actions = opponentActions ?? [];
    const eveActs = eveActions ?? [];
    const roundResults = rounds ?? [];

    // Reset and rebuild model from scratch for consistency
    model.actionHistory = actions.map((a) => a.action);
    model.actionFrequency = { Attack: 0, Defend: 0, Charge: 0, NoAction: 0 };
    model.bigramCounts = new Map();
    model.trigramCounts = new Map();
    model.reactionMap = new Map();
    model.chargeRoundPreference = [];
    model.chargeUsed = false;
    model.currentStreak = { action: null, count: 0 };
    model.roundsWon = roundResults.filter((r) => r.winner === opponentWallet).length;

    // Build frequency counts
    for (const a of actions) {
      model.actionFrequency[a.action]++;
      if (a.action === 'Charge') {
        model.chargeRoundPreference.push(a.round_number);
        model.chargeUsed = true;
      }
    }

    // Build N-gram models
    for (let i = 1; i < actions.length; i++) {
      const bigram = `${actions[i - 1].action}->${actions[i].action}`;
      model.bigramCounts.set(bigram, (model.bigramCounts.get(bigram) || 0) + 1);
    }
    for (let i = 2; i < actions.length; i++) {
      const trigram = `${actions[i - 2].action}->${actions[i - 1].action}->${actions[i].action}`;
      model.trigramCounts.set(trigram, (model.trigramCounts.get(trigram) || 0) + 1);
    }

    // Build reaction map: what does opponent do after EVE plays X?
    for (let i = 0; i < eveActs.length && i < actions.length; i++) {
      // Check if opponent's action in round i+1 is a reaction to EVE's action in round i
      if (i + 1 < actions.length) {
        const eveAction = eveActs[i].action;
        const opponentReaction = actions[i + 1].action;
        const key = eveAction;
        if (!model.reactionMap.has(key)) {
          model.reactionMap.set(key, { Attack: 0, Defend: 0, Charge: 0, NoAction: 0 });
        }
        model.reactionMap.get(key)![opponentReaction]++;
      }
    }

    // Track current streak
    if (actions.length > 0) {
      const last = actions[actions.length - 1].action;
      let streak = 1;
      for (let i = actions.length - 2; i >= 0; i--) {
        if (actions[i].action === last) streak++;
        else break;
      }
      model.currentStreak = { action: last, count: streak };
    }

    this.opponentModels.set(matchId, model);
    return model;
  }

  // =========================================================================
  // Style Detection — classifies opponent into play styles
  // =========================================================================

  private detectOpponentStyle(model: OpponentModel): void {
    const total =
      model.actionFrequency.Attack +
      model.actionFrequency.Defend +
      model.actionFrequency.Charge +
      model.actionFrequency.NoAction;

    if (total < 2) {
      model.detectedStyle = 'unknown';
      model.styleConfidence = 0;
      return;
    }

    const attackRate = model.actionFrequency.Attack / total;
    const defendRate = model.actionFrequency.Defend / total;
    const chargeRate = model.actionFrequency.Charge / total;

    // Calculate entropy to detect chaotic play
    const probs = [attackRate, defendRate, chargeRate].filter((p) => p > 0);
    const entropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
    const maxEntropy = Math.log2(3); // ~1.585 for 3 actions
    const normalizedEntropy = entropy / maxEntropy;

    if (normalizedEntropy > 0.95 && total >= 4) {
      model.detectedStyle = 'chaotic';
      model.styleConfidence = Math.min(1, (total - 2) / 6);
      return;
    }

    if (attackRate >= 0.55) {
      model.detectedStyle = 'aggressive';
      model.styleConfidence = Math.min(1, (attackRate - 0.35) * 3 * Math.min(1, total / 4));
    } else if (defendRate >= 0.55) {
      model.detectedStyle = 'defensive';
      model.styleConfidence = Math.min(1, (defendRate - 0.35) * 3 * Math.min(1, total / 4));
    } else {
      model.detectedStyle = 'balanced';
      model.styleConfidence = Math.min(1, normalizedEntropy * Math.min(1, total / 4));
    }
  }

  // =========================================================================
  // Multi-Layer Prediction
  // =========================================================================

  private predictOpponentAction(
    model: OpponentModel,
    match: MatchRow,
    roundNumber: number
  ): Record<PlayerAction, number> {
    // Start with uniform prior
    const prediction: Record<PlayerAction, number> = {
      Attack: 0.33,
      Defend: 0.33,
      Charge: 0.2,
      NoAction: 0.14,
    };

    const totalActions =
      model.actionFrequency.Attack +
      model.actionFrequency.Defend +
      model.actionFrequency.Charge +
      model.actionFrequency.NoAction;

    if (totalActions === 0) {
      // Round 1: use priors based on game theory
      // Most players either attack or defend first
      return { Attack: 0.45, Defend: 0.40, Charge: 0.10, NoAction: 0.05 };
    }

    // Layer 1: Frequency-based baseline (weight: 0.2)
    const freqWeight = 0.2;
    for (const action of ['Attack', 'Defend', 'Charge', 'NoAction'] as PlayerAction[]) {
      prediction[action] =
        prediction[action] * (1 - freqWeight) +
        (model.actionFrequency[action] / totalActions) * freqWeight;
    }

    // Layer 2: Bigram prediction — what follows the last action? (weight: 0.3)
    if (model.actionHistory.length >= 1) {
      const lastAction = model.actionHistory[model.actionHistory.length - 1];
      const bigramWeight = 0.3;
      const bigramPrediction = this.getBigramPrediction(model, lastAction);
      if (bigramPrediction) {
        for (const action of ['Attack', 'Defend', 'Charge', 'NoAction'] as PlayerAction[]) {
          prediction[action] =
            prediction[action] * (1 - bigramWeight) +
            (bigramPrediction[action] || 0) * bigramWeight;
        }
      }
    }

    // Layer 3: Trigram prediction — extends bigram with 2-action context (weight: 0.25)
    if (model.actionHistory.length >= 2) {
      const prev2 = model.actionHistory[model.actionHistory.length - 2];
      const prev1 = model.actionHistory[model.actionHistory.length - 1];
      const trigramWeight = 0.25;
      const trigramPrediction = this.getTrigramPrediction(model, prev2, prev1);
      if (trigramPrediction) {
        for (const action of ['Attack', 'Defend', 'Charge', 'NoAction'] as PlayerAction[]) {
          prediction[action] =
            prediction[action] * (1 - trigramWeight) +
            (trigramPrediction[action] || 0) * trigramWeight;
        }
      }
    }

    // Layer 4: Reaction pattern — what does opponent do after our last action? (weight: 0.15)
    const eveHistory = this.eveActionHistory.get(match.match_id) || [];
    if (eveHistory.length > 0) {
      const lastEveAction = eveHistory[eveHistory.length - 1];
      const reactionWeight = 0.15;
      const reactionPrediction = this.getReactionPrediction(model, lastEveAction);
      if (reactionPrediction) {
        for (const action of ['Attack', 'Defend', 'Charge', 'NoAction'] as PlayerAction[]) {
          prediction[action] =
            prediction[action] * (1 - reactionWeight) +
            (reactionPrediction[action] || 0) * reactionWeight;
        }
      }
    }

    // Layer 5: Streak-break prediction — players on long streaks tend to change
    if (model.currentStreak.count >= 3 && model.currentStreak.action) {
      const streakBreakProb = Math.min(0.8, 0.3 + model.currentStreak.count * 0.1);
      const currentAction = model.currentStreak.action;
      const redistributed = prediction[currentAction] * streakBreakProb;
      prediction[currentAction] *= 1 - streakBreakProb;
      // Distribute to other actions
      const others = (['Attack', 'Defend', 'Charge', 'NoAction'] as PlayerAction[]).filter(
        (a) => a !== currentAction
      );
      for (const a of others) {
        prediction[a] += redistributed / others.length;
      }
    }

    // Layer 6: Charge availability — if opponent already used charge, it's 0
    if (model.chargeUsed) {
      const chargeProb = prediction.Charge;
      prediction.Charge = 0;
      prediction.Attack += chargeProb * 0.6;
      prediction.Defend += chargeProb * 0.4;
    }

    // Layer 7: Game-state pressure adjustments
    this.applyGameStatePressure(prediction, model, match, roundNumber);

    // Normalize
    this.normalizePrediction(prediction);

    return prediction;
  }

  private getBigramPrediction(
    model: OpponentModel,
    lastAction: PlayerAction
  ): Record<PlayerAction, number> | null {
    const candidates: Record<PlayerAction, number> = {
      Attack: 0,
      Defend: 0,
      Charge: 0,
      NoAction: 0,
    };
    let total = 0;
    for (const [key, count] of model.bigramCounts) {
      if (key.startsWith(`${lastAction}->`)) {
        const nextAction = key.split('->')[1] as PlayerAction;
        candidates[nextAction] = count;
        total += count;
      }
    }
    if (total === 0) return null;
    for (const action of Object.keys(candidates) as PlayerAction[]) {
      candidates[action] /= total;
    }
    return candidates;
  }

  private getTrigramPrediction(
    model: OpponentModel,
    prev2: PlayerAction,
    prev1: PlayerAction
  ): Record<PlayerAction, number> | null {
    const candidates: Record<PlayerAction, number> = {
      Attack: 0,
      Defend: 0,
      Charge: 0,
      NoAction: 0,
    };
    let total = 0;
    const prefix = `${prev2}->${prev1}->`;
    for (const [key, count] of model.trigramCounts) {
      if (key.startsWith(prefix)) {
        const nextAction = key.split('->')[2] as PlayerAction;
        candidates[nextAction] = count;
        total += count;
      }
    }
    if (total === 0) return null;
    for (const action of Object.keys(candidates) as PlayerAction[]) {
      candidates[action] /= total;
    }
    return candidates;
  }

  private getReactionPrediction(
    model: OpponentModel,
    lastEveAction: PlayerAction
  ): Record<PlayerAction, number> | null {
    const reactions = model.reactionMap.get(lastEveAction);
    if (!reactions) return null;
    const total = Object.values(reactions).reduce((s, v) => s + v, 0);
    if (total === 0) return null;
    const result: Record<PlayerAction, number> = { Attack: 0, Defend: 0, Charge: 0, NoAction: 0 };
    for (const action of Object.keys(reactions) as PlayerAction[]) {
      result[action] = reactions[action] / total;
    }
    return result;
  }

  // =========================================================================
  // Game-State Pressure — adjusts predictions based on score/round context
  // =========================================================================

  private applyGameStatePressure(
    prediction: Record<PlayerAction, number>,
    model: OpponentModel,
    match: MatchRow,
    roundNumber: number
  ): void {
    const roundsToWin = Math.floor(match.total_rounds / 2) + 1;
    const opponentWins = model.roundsWon;

    const isLateGame = roundNumber > match.total_rounds * 0.6;
    const opponentDesperate = opponentWins <= roundsToWin - 2 && isLateGame;
    const opponentCloseToWin = opponentWins >= roundsToWin - 1;

    // Desperate opponents tend to become more aggressive
    if (opponentDesperate) {
      prediction.Attack *= 1.4;
      prediction.Charge *= 1.3;
      prediction.Defend *= 0.6;
    }

    // Opponents near victory may play safe
    if (opponentCloseToWin) {
      prediction.Defend *= 1.3;
      prediction.Attack *= 0.9;
    }

    // Late-game charge timing — if opponent hasn't charged yet, probability spikes
    if (!model.chargeUsed && isLateGame) {
      prediction.Charge *= 2.0;
    }

    // Round 1 adjustments — most players don't charge on round 1
    if (roundNumber === 1) {
      prediction.Charge *= 0.2;
      prediction.Attack *= 1.2;
    }
  }

  // =========================================================================
  // Optimal Action Selection — Game-theoretic response to predictions
  // =========================================================================

  private selectOptimalAction(
    prediction: Record<PlayerAction, number>,
    model: OpponentModel,
    match: MatchRow,
    roundNumber: number,
    aiWallet: string
  ): PlayerAction {
    const roundsToWin = Math.floor(match.total_rounds / 2) + 1;
    const isP2 = match.player_2 === aiWallet;
    const eveWins = isP2 ? match.p2_rounds_won : match.p1_rounds_won;

    // Calculate expected value for each action against predicted opponent distribution
    const actionValues: Record<PlayerAction, number> = {
      Attack: 0,
      Defend: 0,
      Charge: 0,
      NoAction: -100,
    };

    // Attack effectiveness matrix (simplified)
    // Attack beats Charge, draws/depends on Attack, can lose to Defend (depends on cards)
    // Defend beats Attack (reduced damage), draws on Defend, loses to nothing
    // Charge beats Defend (momentum), draws on Charge, loses to Attack

    // Against predicted Attack:
    actionValues.Attack += prediction.Attack * 0.3; // Attack vs Attack: slight mutual damage, neutral
    actionValues.Defend += prediction.Attack * 0.9; // Defend vs Attack: strong defensive advantage
    actionValues.Charge += prediction.Attack * -0.6; // Charge vs Attack: vulnerable

    // Against predicted Defend:
    actionValues.Attack += prediction.Defend * 0.5; // Attack vs Defend: moderate, can still win on power
    actionValues.Defend += prediction.Defend * 0.1; // Defend vs Defend: neutral, low damage exchange
    actionValues.Charge += prediction.Defend * 0.8; // Charge vs Defend: excellent for ability setup

    // Against predicted Charge:
    actionValues.Attack += prediction.Charge * 0.8; // Attack vs Charge: strong offensive advantage
    actionValues.Defend += prediction.Charge * 0.4; // Defend vs Charge: decent
    actionValues.Charge += prediction.Charge * 0.0; // Charge vs Charge: neutral waste

    // Against predicted NoAction (timeout):
    actionValues.Attack += prediction.NoAction * 0.9;
    actionValues.Defend += prediction.NoAction * 0.3;
    actionValues.Charge += prediction.NoAction * 0.5;

    // Situational modifiers
    const isLateGame = roundNumber > match.total_rounds * 0.6;
    const eveDesperate = eveWins <= roundsToWin - 2 && isLateGame;
    const eveCloseToWin = eveWins >= roundsToWin - 1;
    const eveHistory = this.eveActionHistory.get(match.match_id) || [];

    // EVE desperately needs wins -> increase aggression
    if (eveDesperate) {
      actionValues.Attack *= 1.5;
      actionValues.Charge *= 1.3;
      actionValues.Defend *= 0.7;
    }

    // EVE close to winning -> play safer
    if (eveCloseToWin) {
      actionValues.Defend *= 1.4;
      actionValues.Attack *= 0.9;
    }

    // Charge value adjustment — only valuable if not yet used
    const eveChargeUsed = eveHistory.includes('Charge');
    if (eveChargeUsed) {
      actionValues.Charge = -100; // Already used
    } else {
      // Save charge for high-value moments
      if (!isLateGame && roundNumber <= 2) {
        actionValues.Charge *= 0.5; // Don't waste charge early
      }
      // If opponent likely defends and we haven't charged, it's optimal timing
      if (prediction.Defend > 0.5 && !eveChargeUsed) {
        actionValues.Charge *= 1.5;
      }
    }

    // Anti-predictability: if we've done the same action twice, reduce its value
    if (eveHistory.length >= 2) {
      const last = eveHistory[eveHistory.length - 1];
      const prev = eveHistory[eveHistory.length - 2];
      if (last === prev && last !== 'Charge') {
        actionValues[last] *= 0.7;
      }
    }

    // Counter-adaptation: if opponent is reading our patterns, add noise
    if (model.styleConfidence > 0.7 && model.detectedStyle !== 'chaotic') {
      // High-confidence read means opponent might be adapting too
      // Inject controlled randomness to stay unpredictable
      const noise = 0.15;
      for (const action of ['Attack', 'Defend', 'Charge'] as PlayerAction[]) {
        actionValues[action] += (Math.random() - 0.5) * noise;
      }
    }

    // Select action with highest expected value
    let bestAction: PlayerAction = 'Attack';
    let bestValue = -Infinity;
    for (const [action, value] of Object.entries(actionValues) as [PlayerAction, number][]) {
      if (action === 'NoAction') continue;
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    // Stochastic selection: 80% exploit best action, 20% use weighted distribution
    // This prevents perfect predictability while still being optimal most of the time
    if (Math.random() > 0.80) {
      bestAction = this.weightedRandomAction(actionValues);
    }

    return bestAction;
  }

  // =========================================================================
  // Meta-Game Adjustments
  // =========================================================================

  private applyMetaGameAdjustments(
    action: PlayerAction,
    model: OpponentModel,
    match: MatchRow,
    roundNumber: number,
    aiWallet: string
  ): PlayerAction {
    const eveHistory = this.eveActionHistory.get(match.match_id) || [];

    // 1. Avoid 3+ consecutive same actions (too predictable)
    if (eveHistory.length >= 2) {
      const last2 = eveHistory.slice(-2);
      if (last2[0] === last2[1] && last2[1] === action && action !== 'Charge') {
        console.log(`[E.V.E META] Breaking 3-action streak of ${action}`);
        // Switch to the action that counters the predicted counter
        if (action === 'Attack') return Math.random() < 0.6 ? 'Defend' : 'Charge';
        if (action === 'Defend') return 'Attack';
        return 'Attack';
      }
    }

    // 2. Psychological pressure: after winning 2+ consecutive rounds, maintain tempo
    const isP2 = match.player_2 === aiWallet;
    const eveWins = isP2 ? match.p2_rounds_won : match.p1_rounds_won;
    if (eveWins >= 2 && eveHistory.length >= 2) {
      const lastAction = eveHistory[eveHistory.length - 1];
      // If last winning action was Attack and opponent is now likely to Defend,
      // consider switching to Charge for maximum impact
      if (lastAction === 'Attack' && model.detectedStyle === 'defensive') {
        if (action === 'Attack' && !eveHistory.includes('Charge') && Math.random() < 0.4) {
          console.log(`[E.V.E META] Surprise Charge against defensive opponent`);
          return 'Charge';
        }
      }
    }

    // 3. Style-specific counter-strategies
    switch (model.detectedStyle) {
      case 'aggressive':
        // Against aggro: favor Defend, then counter-attack
        if (action === 'Attack' && model.styleConfidence > 0.6 && Math.random() < 0.35) {
          console.log(`[E.V.E META] Counter-aggro: switching to Defend`);
          return 'Defend';
        }
        break;
      case 'defensive':
        // Against defense: Attack more, save Charge for when they're locked into Defend
        if (action === 'Defend' && model.styleConfidence > 0.6 && Math.random() < 0.35) {
          console.log(`[E.V.E META] Counter-defense: switching to Attack`);
          return 'Attack';
        }
        break;
      case 'chaotic':
        // Against chaotic: play Nash equilibrium mixed strategy
        if (Math.random() < 0.3) {
          const nashAction = this.nashEquilibriumAction(
            eveHistory.includes('Charge')
          );
          console.log(`[E.V.E META] Nash equilibrium vs chaotic: ${nashAction}`);
          return nashAction;
        }
        break;
    }

    // 4. Punish repeated opponent patterns
    if (model.currentStreak.count >= 2 && model.currentStreak.action) {
      const opAction = model.currentStreak.action;
      if (opAction === 'Attack' && action !== 'Defend') {
        console.log(`[E.V.E META] Punishing Attack streak with Defend`);
        return 'Defend';
      }
      if (opAction === 'Defend' && action !== 'Attack' && action !== 'Charge') {
        console.log(`[E.V.E META] Punishing Defend streak with Attack`);
        return 'Attack';
      }
    }

    return action;
  }

  // =========================================================================
  // Dynamic Deck Building for E.V.E
  // =========================================================================

  /**
   * Builds an optimal 3-card deck by evaluating ALL available templates.
   * Considers synergy between cards, ability coverage, and asset diversity.
   */
  async buildOptimalDeck(
    matchId: number,
    aiWallet: string
  ): Promise<{ cardIds: number[]; activeCardId: number } | null> {
    try {
      console.log(`[E.V.E DECK] Building optimal deck for match ${matchId}`);

      // First check if already has a deck
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

      // Fetch ALL AI-enabled templates
      const { data: allTemplates } = await this.supabase
        .from('card_templates')
        .select(
          'template_id, asset, name, base, base_power, attack_affinity, defense_affinity, charge_affinity, volatility_sensitivity, ability_id'
        )
        .eq('is_ai_card', true)
        .returns<CardTemplateRow[]>();

      let templates = allTemplates ?? [];

      // Fallback to all templates if no AI-specific ones
      if (templates.length < 3) {
        console.warn('[E.V.E DECK] Not enough AI templates, falling back to all templates');
        const { data: fallback } = await this.supabase
          .from('card_templates')
          .select(
            'template_id, asset, name, base, base_power, attack_affinity, defense_affinity, charge_affinity, volatility_sensitivity, ability_id'
          )
          .returns<CardTemplateRow[]>();
        templates = fallback ?? [];
      }

      if (templates.length < 3) {
        console.error('[E.V.E DECK] Not enough templates to build a deck');
        return null;
      }

      // Score each template individually
      const scored = templates.map((t) => ({
        template: t,
        individualScore: this.scoreTemplate(t),
      }));

      // Find the optimal 3-card combination (considering synergy)
      const bestCombo = this.findOptimalCombination(scored);

      if (bestCombo.length < 3) {
        // Fallback: just pick top 3 by individual score
        scored.sort((a, b) => b.individualScore - a.individualScore);
        const fallbackPicks = scored.slice(0, 3).map((s) => s.template);
        return this.assignDeck(matchId, aiWallet, fallbackPicks);
      }

      return this.assignDeck(
        matchId,
        aiWallet,
        bestCombo.map((s) => s.template)
      );
    } catch (err) {
      console.error('[E.V.E DECK] Error building deck:', err);
      return null;
    }
  }

  private scoreTemplate(t: CardTemplateRow): number {
    const basePower = t.base_power ?? t.base;
    const attack = t.attack_affinity;
    const defense = t.defense_affinity;
    const charge = t.charge_affinity ?? 0;
    const vol = t.volatility_sensitivity;

    // E.V.E values versatile cards that perform well in multiple scenarios
    // High base power is always good
    // Attack and defense affinity are both valuable (balanced play)
    // Charge affinity matters for ability activation
    // Moderate volatility is preferred (not too sensitive to market swings)

    const powerScore = basePower * 0.30;
    const attackScore = attack * 25 * 0.25;
    const defenseScore = defense * 25 * 0.25;
    const chargeScore = charge * 15 * 0.10;
    const volPenalty = Math.abs(vol - 1.0) * 5 * 0.10; // Prefer vol close to 1.0

    return powerScore + attackScore + defenseScore + chargeScore - volPenalty;
  }

  private findOptimalCombination(
    scored: Array<{ template: CardTemplateRow; individualScore: number }>
  ): Array<{ template: CardTemplateRow; individualScore: number }> {
    if (scored.length < 3) return scored;

    // For small sets, evaluate all 3-card combinations
    // For large sets, pre-filter to top 10 by individual score then evaluate combos
    const candidates =
      scored.length > 12
        ? [...scored].sort((a, b) => b.individualScore - a.individualScore).slice(0, 10)
        : scored;

    let bestCombo: typeof candidates = [];
    let bestScore = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        for (let k = j + 1; k < candidates.length; k++) {
          const combo = [candidates[i], candidates[j], candidates[k]];
          const score = this.evaluateCombinationSynergy(combo);
          if (score > bestScore) {
            bestScore = score;
            bestCombo = combo;
          }
        }
      }
    }

    console.log(`[E.V.E DECK] Best combination score: ${bestScore.toFixed(2)}`);
    return bestCombo;
  }

  private evaluateCombinationSynergy(
    combo: Array<{ template: CardTemplateRow; individualScore: number }>
  ): number {
    // Base: sum of individual scores
    let score = combo.reduce((sum, c) => sum + c.individualScore, 0);

    // Bonus: Asset diversity (different assets = better coverage)
    const assets = new Set(combo.map((c) => c.template.asset));
    score += (assets.size - 1) * 3; // +3 per unique asset beyond the first

    // Bonus: Ability diversity (different abilities = more tactical options)
    const abilities = new Set(
      combo
        .map((c) => c.template.ability_id)
        .filter(Boolean)
    );
    score += (abilities.size - 1) * 4; // +4 per unique ability

    // Bonus: Role coverage — at least one strong attacker and one strong defender
    const hasStrongAttacker = combo.some((c) => c.template.attack_affinity >= 1.1);
    const hasStrongDefender = combo.some((c) => c.template.defense_affinity >= 1.1);
    const hasStrongCharger = combo.some((c) => (c.template.charge_affinity ?? 0) >= 1.0);
    if (hasStrongAttacker) score += 2;
    if (hasStrongDefender) score += 2;
    if (hasStrongCharger) score += 1.5;

    // Penalty: Too similar cards (same asset & similar stats = redundant)
    for (let i = 0; i < combo.length; i++) {
      for (let j = i + 1; j < combo.length; j++) {
        const a = combo[i].template;
        const b = combo[j].template;
        if (a.asset === b.asset) {
          score -= 2; // Same asset penalty
        }
        // Similar stats penalty
        const statDiff =
          Math.abs(a.attack_affinity - b.attack_affinity) +
          Math.abs(a.defense_affinity - b.defense_affinity);
        if (statDiff < 0.2) {
          score -= 1.5; // Too similar
        }
      }
    }

    return score;
  }

  private async assignDeck(
    matchId: number,
    aiWallet: string,
    templates: CardTemplateRow[]
  ): Promise<{ cardIds: number[]; activeCardId: number } | null> {
    const templateIds = templates.map((t) => t.template_id);

    // Ensure bot_cards exist for these templates
    await this.supabase
      .from('bot_cards')
      .upsert(
        templateIds.map((id) => ({ template_id: id })),
        { onConflict: 'template_id' }
      );

    // Fetch the bot_card IDs
    const { data: botCards } = await this.supabase
      .from('bot_cards')
      .select('id, template_id')
      .in('template_id', templateIds);

    if (!botCards || botCards.length < 3) {
      console.error('[E.V.E DECK] Could not create bot cards');
      return null;
    }

    // Map template_id -> bot_card.id, preserving our selection order
    const templateToBotCard = new Map(botCards.map((bc) => [bc.template_id, bc.id as number]));
    const cardIds = templateIds.map((tid) => templateToBotCard.get(tid)!).filter(Boolean);

    if (cardIds.length < 3) {
      console.error('[E.V.E DECK] Card ID mapping incomplete');
      return null;
    }

    // Pick the most versatile card as active (highest combined attack + defense affinity)
    const activeTemplate = templates.reduce((best, t) => {
      const bestScore = best.attack_affinity + best.defense_affinity;
      const tScore = t.attack_affinity + t.defense_affinity;
      return tScore > bestScore ? t : best;
    });
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
      console.error('[E.V.E DECK] Failed to assign deck:', error);
      return null;
    }

    console.log(
      `[E.V.E DECK] Assigned deck: [${cardIds.join(', ')}] — ` +
        `Active: ${activeCardId} (${activeTemplate.name} ${activeTemplate.asset})`
    );

    return { cardIds: cardIds.slice(0, 3), activeCardId };
  }

  // =========================================================================
  // Per-Round Card Selection — picks the best card for the current situation
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
      const model = this.opponentModels.get(matchId);

      // Check swap lock
      void this.supabase
        .from('matches')
        .select('bot_id')
        .eq('match_id', matchId)
        .maybeSingle();

      // Get deck
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

      // Fetch full card data for all deck cards
      const { data: deckCards } = await this.supabase
        .from('bot_cards')
        .select(
          'id, template_id, template:card_templates(template_id, asset, name, base, base_power, attack_affinity, defense_affinity, charge_affinity, volatility_sensitivity, ability_id)'
        )
        .in('id', options);

      if (!deckCards || deckCards.length === 0) {
        return { nextCardId: options[0], cardAsset: null, cardData: null };
      }

      // Predict what we'll likely play this round
      const eveHistory = this.eveActionHistory.get(matchId) || [];
      const likelyAction = this.guessOurNextAction(model, eveHistory);

      // Score each card based on our likely action and opponent model
      const cardScores = deckCards
        .filter((c) => c.template)
        .map((c) => {
          const t = c.template as unknown as {
            template_id: number;
            asset: string;
            name: string;
            base: number;
            base_power: number | null;
            attack_affinity: number;
            defense_affinity: number;
            charge_affinity: number;
            volatility_sensitivity: number;
            ability_id: string | null;
          };

          let score = 0;
          const basePower = t.base_power ?? t.base;

          // Base power is always valuable
          score += basePower * 0.3;

          // Score based on likely action
          if (likelyAction === 'Attack') {
            score += t.attack_affinity * 20;
            score += basePower * 0.2; // Extra base power matters for attacks
          } else if (likelyAction === 'Defend') {
            score += t.defense_affinity * 20;
          } else if (likelyAction === 'Charge') {
            score += (t.charge_affinity ?? 0) * 15;
            // Ability value matters more when charging
            if (t.ability_id) score += 5;
          }

          // Versatility bonus for cards that are good at multiple things
          const versatility =
            (t.attack_affinity + t.defense_affinity + (t.charge_affinity ?? 0)) / 3;
          score += versatility * 5;

          // Small randomization to prevent pure determinism
          score += Math.random() * 2;

          return { id: c.id as number, score, template: t };
        });

      cardScores.sort((a, b) => b.score - a.score);
      const nextCardId = cardScores[0]?.id ?? options[0];

      // Update active card
      await this.supabase
        .from('match_players')
        .update({ bot_active_card_id: nextCardId })
        .eq('match_id', matchId)
        .eq('player_wallet', aiWallet);

      const selectedCard = cardScores[0];
      console.log(
        `[E.V.E CARD] Round ${roundNumber}: Selected ${selectedCard?.template?.name ?? 'unknown'} ` +
          `(${selectedCard?.template?.asset ?? '?'}) — Score: ${selectedCard?.score?.toFixed(1) ?? '?'} ` +
          `— Likely action: ${likelyAction}`
      );

      return {
        nextCardId,
        cardAsset: selectedCard?.template?.asset ?? null,
        cardData: deckCards.find((c) => (c.id as number) === nextCardId) ?? null,
      };
    } catch (err) {
      console.error('[E.V.E CARD] Error selecting card:', err);
      return null;
    }
  }

  private guessOurNextAction(
    model: OpponentModel | undefined,
    eveHistory: PlayerAction[]
  ): PlayerAction {
    // Simple heuristic to estimate what E.V.E will likely play
    // (used to pick the best card before the actual action decision)
    const chargeUsed = eveHistory.includes('Charge');

    if (!model || model.actionHistory.length === 0) {
      return 'Attack'; // Default to aggressive card for round 1
    }

    if (model.detectedStyle === 'aggressive') return 'Defend';
    if (model.detectedStyle === 'defensive') return 'Attack';
    if (!chargeUsed && model.detectedStyle === 'balanced') return 'Charge';

    // Default to Attack
    return 'Attack';
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

  private assessCriticality(match: MatchRow, roundNumber: number): number {
    const roundsToWin = Math.floor(match.total_rounds / 2) + 1;
    const maxWins = Math.max(match.p1_rounds_won, match.p2_rounds_won);
    const closeness = maxWins / roundsToWin;
    const lateGame = roundNumber / match.total_rounds;
    return Math.min(1, closeness * 0.6 + lateGame * 0.4);
  }

  private async validateCharge(
    matchId: number,
    roundNumber: number,
    aiWallet: string
  ): Promise<boolean> {
    // Check if charge was already used in this match
    const { data: chargeUsedRow } = await this.supabase
      .from('match_players')
      .select('charge_used')
      .eq('match_id', matchId)
      .eq('player_wallet', aiWallet)
      .maybeSingle();

    if (chargeUsedRow?.charge_used) return false;

    // Check if charge already submitted this round
    const { data: chargeRow } = await this.supabase
      .from('match_actions')
      .select('id')
      .eq('match_id', matchId)
      .eq('round_number', roundNumber)
      .eq('action', 'Charge')
      .maybeSingle();

    return !chargeRow;
  }

  private getChargeFallback(
    prediction: Record<PlayerAction, number>
  ): PlayerAction {
    // If Charge isn't available, pick next best action
    if (prediction.Attack >= prediction.Defend) {
      return 'Defend'; // Counter likely Attack with Defend
    }
    return 'Attack'; // Counter likely Defend with Attack
  }

  private nashEquilibriumAction(chargeUsed: boolean): PlayerAction {
    // Approximate Nash equilibrium for the 3-action game
    // Attack: ~40%, Defend: ~40%, Charge: ~20% (when available)
    const rand = Math.random();
    if (chargeUsed) {
      return rand < 0.5 ? 'Attack' : 'Defend';
    }
    if (rand < 0.4) return 'Attack';
    if (rand < 0.8) return 'Defend';
    return 'Charge';
  }

  private weightedRandomAction(
    values: Record<PlayerAction, number>
  ): PlayerAction {
    const actions: PlayerAction[] = ['Attack', 'Defend', 'Charge'];
    // Shift to positive
    const minVal = Math.min(...actions.map((a) => values[a]));
    const shifted = actions.map((a) => ({
      action: a,
      weight: Math.max(0.01, values[a] - minVal + 0.1),
    }));
    const total = shifted.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * total;
    for (const { action, weight } of shifted) {
      roll -= weight;
      if (roll <= 0) return action;
    }
    return 'Attack';
  }

  private normalizePrediction(
    prediction: Record<PlayerAction, number>
  ): void {
    const total = Object.values(prediction).reduce((s, v) => s + Math.max(0, v), 0);
    if (total <= 0) {
      prediction.Attack = 0.4;
      prediction.Defend = 0.4;
      prediction.Charge = 0.15;
      prediction.NoAction = 0.05;
      return;
    }
    for (const action of Object.keys(prediction) as PlayerAction[]) {
      prediction[action] = Math.max(0, prediction[action]) / total;
    }
  }
}
