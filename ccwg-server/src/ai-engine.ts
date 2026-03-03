//ccwg-web/server/ai-engine.ts

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlayerAction, AIDifficulty } from '@ccwg/shared';

type MatchRow = {
  player_1: string;
  p1_rounds_won: number;
  p2_rounds_won: number;
  total_rounds: number;
};

type MatchActionRow = {
  action: PlayerAction;
};

type MatchRoundRow = {
  winner: string | null;
  round_number: number;
};

function safeNonce(prefix: string) {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

type AIActionCallback = (args: {
  matchId: number;
  roundNumber: number;
  playerWallet: string;
  action: PlayerAction;
  clientNonce: string;
}) => Promise<void>;

export class AIEngine {
  private supabase: SupabaseClient;
  private timers = new Set<NodeJS.Timeout>();
  private onAction: AIActionCallback | null;

  constructor(supabase: SupabaseClient, onAction?: AIActionCallback) {
    this.supabase = supabase;
    this.onAction = onAction || null;
  }

  async submitAIAction(
    matchId: number,
    roundNumber: number,
    aiWallet: string,
    forceImmediate = false
  ) {
    const bot = await this.getBotProfile(matchId);
    const difficulty = (bot?.difficulty as AIDifficulty) ?? (await this.getAIDifficulty(matchId));
    const delay = forceImmediate ? 150 + Math.random() * 300 : this.getReactionDelay(difficulty);

    console.log(`[AI ENGINE] Scheduling AI action for match ${matchId} round ${roundNumber} with ${delay}ms delay (difficulty: ${difficulty})`);

    const timer = setTimeout(() => {
      void this.runAIAction(matchId, roundNumber, aiWallet, difficulty, bot);
    }, delay);

    this.timers.add(timer);
    timer.unref?.();
  }

  stopAllTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  private async runAIAction(
    matchId: number,
    roundNumber: number,
    aiWallet: string,
    difficulty: AIDifficulty,
    bot: BotProfileRow | null
  ) {
    try {
      console.log(`[AI ENGINE] Running AI action for match ${matchId} round ${roundNumber}`);
      
      let action = await this.selectAction(matchId, roundNumber, difficulty, bot, aiWallet);
      console.log(`[AI ENGINE] Initial action selected: ${action}`);

      // Validate Charge action
      if (action === 'Charge') {
        const { data: chargeRow } = await this.supabase
          .from('match_actions')
          .select('id, player_wallet')
          .eq('match_id', matchId)
          .eq('round_number', roundNumber)
          .eq('action', 'Charge')
          .maybeSingle();

        const { data: chargeUsedRow } = await this.supabase
          .from('match_players')
          .select('charge_used')
          .eq('match_id', matchId)
          .eq('player_wallet', aiWallet)
          .maybeSingle();

        if (chargeRow || chargeUsedRow?.charge_used) {
          console.log(`[AI ENGINE] Charge validation failed, switching to Defend`);
          action = 'Defend';
        }
      }

      console.log(`[AI ENGINE] Final action after validation: ${action}`);

      const nonce = safeNonce('ai');
      if (this.onAction) {
        console.log(`[AI ENGINE] Calling onAction callback with action: ${action}`);
        await this.onAction({
          matchId,
          roundNumber,
          playerWallet: aiWallet,
          action,
          clientNonce: nonce,
        });
        return;
      }

      // Fallback: direct DB insertion (should not be reached if onAction is set)
      const { data: matchPlayer, error: mpErr } = await this.supabase
        .from('match_players')
        .select('active_card_id')
        .eq('match_id', matchId)
        .eq('player_wallet', aiWallet)
        .single();

      if (mpErr || !matchPlayer?.active_card_id) {
        console.error(`[AI ENGINE] Failed to get match player or active card:`, mpErr);
        return;
      }

      const { error: insertErr } = await this.supabase.from('match_actions').insert({
        match_id: matchId,
        round_number: roundNumber,
        player_wallet: aiWallet,
        action,
        card_id: matchPlayer.active_card_id,
        client_nonce: nonce,
      });

      if (insertErr) {
        console.error('[AI ENGINE] Failed to insert AI action:', insertErr);
      } else {
        console.log(`[AI ENGINE] AI action inserted successfully: ${action}`);
      }
    } catch (err) {
      console.error('[AI ENGINE] runAIAction error:', err);
    }
  }

  private async getAIDifficulty(matchId: number): Promise<AIDifficulty> {
    try {
      const { data } = await this.supabase
        .from('matches')
        .select('mode')
        .eq('match_id', matchId)
        .maybeSingle();

      void data;
      return 'Medium';
    } catch {
      return 'Medium';
    }
  }

  private async getBotProfile(matchId: number): Promise<BotProfileRow | null> {
    try {
      const { data: match } = await this.supabase
        .from('matches')
        .select('bot_id')
        .eq('match_id', matchId)
        .maybeSingle();

      if (!match?.bot_id) return null;

      const { data: bot } = await this.supabase
        .from('bots')
        .select('bot_id, name, difficulty, aggression, defense, charge_bias')
        .eq('bot_id', match.bot_id)
        .maybeSingle();

      if (bot) {
        console.log(`[AI ENGINE] Bot profile loaded: ${bot.name} (difficulty: ${bot.difficulty})`);
      }

      return bot ?? null;
    } catch (err) {
      console.error('[AI ENGINE] Failed to load bot profile:', err);
      return null;
    }
  }

  private getReactionDelay(difficulty: AIDifficulty): number {
    switch (difficulty) {
      case 'Easy':
        return 3000 + Math.random() * 2000; // 3-5 seconds
      case 'Medium':
        return 2000 + Math.random() * 1000; // 2-3 seconds
      case 'Hard':
        return 1000 + Math.random() * 500; // 1-1.5 seconds
      default:
        return 2000;
    }
  }

  private async selectAction(
    matchId: number,
    roundNumber: number,
    difficulty: AIDifficulty,
    bot: BotProfileRow | null,
    aiWallet: string
  ): Promise<PlayerAction> {
    try {
      console.log(`[AI STRATEGY] Match ${matchId} Round ${roundNumber} - Difficulty: ${difficulty}`);

      const { data: match, error: matchErr } = await this.supabase
        .from('matches')
        .select('player_1, p1_rounds_won, p2_rounds_won, total_rounds')
        .eq('match_id', matchId)
        .single<MatchRow>();

      if (matchErr || !match) {
        console.error('[AI STRATEGY] Failed to fetch match:', matchErr);
        return 'Defend';
      }

      const { data: previousRoundsData } = await this.supabase
        .from('match_rounds')
        .select('winner, round_number')
        .eq('match_id', matchId)
        .lt('round_number', roundNumber)
        .order('round_number', { ascending: false })
        .limit(3)
        .returns<MatchRoundRow[]>();

      const { data: previousActionsData } = await this.supabase
        .from('match_actions')
        .select('action')
        .eq('match_id', matchId)
        .eq('player_wallet', match.player_1) // Opponent's actions
        .lt('round_number', roundNumber)
        .order('round_number', { ascending: false })
        .limit(5)
        .returns<MatchActionRow[]>();

      const { data: previousAIActionsData } = await this.supabase
        .from('match_actions')
        .select('action')
        .eq('match_id', matchId)
        .eq('player_wallet', aiWallet)
        .lt('round_number', roundNumber)
        .order('round_number', { ascending: false })
        .limit(2)
        .returns<MatchActionRow[]>();

      const previousRounds = previousRoundsData ?? [];
      const previousActions = previousActionsData ?? [];

      let baseAction: PlayerAction;

      switch (difficulty) {
        case 'Easy':
          baseAction = this.easyStrategy();
          console.log(`[AI STRATEGY] Easy strategy selected: ${baseAction}`);
          break;
        case 'Medium':
          baseAction = this.mediumStrategy(previousActions);
          console.log(`[AI STRATEGY] Medium strategy selected: ${baseAction}`);
          break;
        case 'Hard':
          baseAction = this.hardStrategy(match, previousActions, previousRounds);
          console.log(`[AI STRATEGY] Hard strategy selected: ${baseAction}`);
          break;
        default:
          console.warn(`[AI STRATEGY] Unknown difficulty ${difficulty}, defaulting to Defend`);
          baseAction = 'Defend';
      }

      const withBias = bot ? this.applyBotBias(baseAction, bot) : baseAction;
      console.log(`[AI STRATEGY] After bot bias: ${withBias}`);

      const notStale = this.avoidStaleDefense(withBias, previousAIActionsData ?? []);
      console.log(`[AI STRATEGY] After stale defense check: ${notStale}`);

      const final = this.deEmphasizeEarlyCharge(notStale, roundNumber, bot);
      console.log(`[AI STRATEGY] Final action: ${final}`);

      return final;
    } catch (err) {
      console.error('[AI STRATEGY] selectAction error:', err);
      return 'Defend';
    }
  }

  private easyStrategy(): PlayerAction {
    const rand = Math.random();
    if (rand < 0.5) return 'Defend';
    if (rand < 0.8) return 'Attack';
    return 'Charge';
  }

  private mediumStrategy(previousActions: MatchActionRow[]): PlayerAction {
    if (previousActions.length === 0) {
      const action = Math.random() < 0.5 ? 'Attack' : 'Defend';
      console.log(`[AI STRATEGY] Medium - No history, random: ${action}`);
      return action;
    }

    const counts: Record<PlayerAction, number> = {
      Attack: 0,
      Defend: 0,
      Charge: 0,
      NoAction: 0,
    };

    for (const row of previousActions) {
      counts[row.action] = (counts[row.action] ?? 0) + 1;
    }

    console.log(`[AI STRATEGY] Medium - Opponent action counts:`, counts);

    const mostFrequent = (Object.entries(counts) as Array<[PlayerAction, number]>).sort(
      (a, b) => b[1] - a[1]
    )[0];

    const [action] = mostFrequent;
    console.log(`[AI STRATEGY] Medium - Most frequent opponent action: ${action}`);

    // Counter the most frequent action
    if (action === 'Attack') return 'Defend';
    if (action === 'Defend') return 'Attack';

    return Math.random() < 0.5 ? 'Attack' : 'Defend';
  }

  private hardStrategy(
    match: MatchRow,
    previousActions: MatchActionRow[],
    previousRounds: MatchRoundRow[]
  ): PlayerAction {
    const opponentLikelyAction = this.predictOpponentAction(previousActions);
    console.log(`[AI STRATEGY] Hard - Predicted opponent action: ${opponentLikelyAction}`);

    const roundsToWin = Math.floor(match.total_rounds / 2) + 1;
    const aiRoundsWon = match.p2_rounds_won;
    const playerRoundsWon = match.p1_rounds_won;

    console.log(`[AI STRATEGY] Hard - Score: AI ${aiRoundsWon} vs Player ${playerRoundsWon} (need ${roundsToWin} to win)`);

    // Aggressive if player is close to winning
    if (playerRoundsWon >= roundsToWin - 1) {
      console.log(`[AI STRATEGY] Hard - Player close to winning, being aggressive`);
      if (opponentLikelyAction === 'Defend') return Math.random() < 0.6 ? 'Charge' : 'Attack';
      return Math.random() < 0.8 ? 'Attack' : 'Charge';
    }

    // Defensive if AI is close to winning
    if (aiRoundsWon >= roundsToWin - 1) {
      console.log(`[AI STRATEGY] Hard - AI close to winning, being defensive`);
      if (opponentLikelyAction === 'Attack') return 'Defend';
      return Math.random() < 0.7 ? 'Defend' : 'Attack';
    }

    // Momentum trends
    if (previousRounds.length >= 2) {
      const recentWins = previousRounds
        .slice(0, 2)
        .filter((r) => r.winner === match.player_1).length;

      if (recentWins === 2) {
        console.log(`[AI STRATEGY] Hard - Player won last 2 rounds, breaking streak`);
        if (opponentLikelyAction === 'Attack') return Math.random() < 0.7 ? 'Defend' : 'Charge';
        return Math.random() < 0.6 ? 'Charge' : 'Attack';
      }
    }

    // Balanced: adapt to prediction
    if (opponentLikelyAction === 'Attack') {
      console.log(`[AI STRATEGY] Hard - Balanced, opponent likely attacks`);
      return Math.random() < 0.55 ? 'Defend' : 'Attack';
    }
    if (opponentLikelyAction === 'Defend') {
      console.log(`[AI STRATEGY] Hard - Balanced, opponent likely defends`);
      return Math.random() < 0.55 ? 'Attack' : 'Charge';
    }

    console.log(`[AI STRATEGY] Hard - Balanced, no clear pattern`);
    const rand = Math.random();
    if (rand < 0.4) return 'Attack';
    if (rand < 0.7) return 'Defend';
    return 'Charge';
  }

  private predictOpponentAction(previousActions: MatchActionRow[]): PlayerAction | null {
    if (previousActions.length === 0) return null;

    const counts: Partial<Record<PlayerAction, number>> = {};
    for (const row of previousActions) {
      counts[row.action] = (counts[row.action] ?? 0) + 1;
    }

    const sorted = (Object.entries(counts) as Array<[PlayerAction, number]>).sort(
      (a, b) => b[1] - a[1]
    );

    return sorted[0]?.[0] ?? null;
  }

  private applyBotBias(action: PlayerAction, bot: BotProfileRow): PlayerAction {
    const aggression = bot.aggression ?? 50;
    const defense = bot.defense ?? 50;
    const charge = bot.charge_bias ?? 25;

    console.log(`[AI BIAS] Bot stats - Aggression: ${aggression}, Defense: ${defense}, Charge: ${charge}`);

    const weights: Record<PlayerAction, number> = {
      Attack: Math.max(1, aggression),
      Defend: Math.max(1, defense),
      Charge: Math.max(1, charge),
      NoAction: 0,
    };

    const pool = ['Attack', 'Defend', 'Charge'] as PlayerAction[];
    const total = pool.reduce((sum, a) => sum + (weights[a] || 0), 0);

    if (total <= 0) return action;

    let roll = Math.random() * total;
    for (const a of pool) {
      roll -= weights[a] || 0;
      if (roll <= 0) {
        console.log(`[AI BIAS] Bias changed action from ${action} to ${a}`);
        return a;
      }
    }

    return action;
  }

  private avoidStaleDefense(action: PlayerAction, previousAIActions: MatchActionRow[]): PlayerAction {
    if (previousAIActions.length < 2) return action;
    const [a1, a2] = previousAIActions;
    if (a1.action === 'Defend' && a2.action === 'Defend' && action === 'Defend') {
      console.log(`[AI STRATEGY] Avoiding 3rd consecutive Defend`);
      return Math.random() < 0.7 ? 'Attack' : 'Charge';
    }
    return action;
  }

  private deEmphasizeEarlyCharge(
    action: PlayerAction,
    roundNumber: number,
    bot: BotProfileRow | null
  ): PlayerAction {
    if (action !== 'Charge') return action;
    if (roundNumber > 1) return action;
    
    const chargeBias = bot?.charge_bias ?? 25;
    const allow = chargeBias >= 60 ? 0.5 : 0.2;
    
    if (Math.random() >= allow) {
      console.log(`[AI STRATEGY] De-emphasizing Charge in round 1 (bias: ${chargeBias})`);
      return 'Attack';
    }
    
    return 'Charge';
  }
}

type BotProfileRow = {
  bot_id: number;
  name: string;
  difficulty: string;
  aggression: number | null;
  defense: number | null;
  charge_bias: number | null;
};