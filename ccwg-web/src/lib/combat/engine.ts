import type { CardAsset, PlayerAction } from '@/src/types/database';

export interface CardStats {
  base: number;
  attack_affinity: number;
  defense_affinity: number;
  charge_affinity: number;
  volatility_sensitivity: number;
}

export interface CombatInput {
  playerCard: CardStats;
  opponentCard: CardStats;
  playerAction: PlayerAction;
  opponentAction: PlayerAction;
  playerMomentum: number; // Decimal (e.g., 0.04 = 4%)
  opponentMomentum: number;
  playerChargeActive: boolean;
  opponentChargeActive: boolean;
  playerAbilityEffects?: AbilityEffect[];
  opponentAbilityEffects?: AbilityEffect[];
}

export interface AbilityEffect {
  type:
    | 'momentum_boost'
    | 'defense_penalty'
    | 'ignore_negative'
    | 'block_action'
    | 'damage_taken_multiplier';
  value?: number;
}

export interface CombatResult {
  playerDamage: number;
  opponentDamage: number;
  winner: 'player' | 'opponent' | 'draw';
  description: string;
}

export class CombatEngine {
  private applyAbilityMomentum(
    momentum: number,
    abilityEffects: AbilityEffect[] = []
  ): number {
    let effectiveMomentum = momentum;

    for (const effect of abilityEffects) {
      if (effect.type === 'momentum_boost' && typeof effect.value === 'number') {
        effectiveMomentum += effect.value;
      }
      if (effect.type === 'ignore_negative' && effectiveMomentum < 0) {
        effectiveMomentum = 0;
      }
    }

    return effectiveMomentum;
  }

  private computeDamage(
    card: CardStats,
    action: PlayerAction,
    momentum: number,
    abilityEffects: AbilityEffect[] = []
  ): number {
    const basePower = card.base;

    const effectiveMomentum = this.applyAbilityMomentum(
      momentum * card.volatility_sensitivity,
      abilityEffects
    );

    const momentumPercent = effectiveMomentum * 100;

    const safeAffinity = (value: number) =>
      Number.isFinite(value) && value !== 0 ? value : 1;

    let adjusted = 0;
    if (action === 'Attack') {
      const affinity = safeAffinity(card.attack_affinity);
      adjusted = momentumPercent >= 0 ? momentumPercent * affinity : (-momentumPercent) / affinity;
    } else if (action === 'Defend') {
      const affinity = safeAffinity(card.defense_affinity);
      adjusted = momentumPercent >= 0 ? momentumPercent / affinity : (-momentumPercent) * affinity;
    } else if (action === 'Charge') {
      const affinity = safeAffinity(card.charge_affinity);
      adjusted = momentumPercent >= 0 ? momentumPercent / affinity : (-momentumPercent) * affinity;
    }

    let damage = basePower + adjusted;

    for (const effect of abilityEffects) {
      if (effect.type === 'defense_penalty' && typeof effect.value === 'number') {
        damage *= (1 - effect.value / 100);
      }
    }

    return Math.max(0, damage);
  }

  /**
   * Resolve combat round with new formula
   */
  public resolveCombat(input: CombatInput): CombatResult {
    const {
      playerCard,
      opponentCard,
      playerAction,
      opponentAction,
      playerMomentum,
      opponentMomentum,
      playerChargeActive,
      opponentChargeActive,
      playerAbilityEffects = [],
      opponentAbilityEffects = [],
    } = input;

    // Check for action blocks from abilities
    const playerBlocked = opponentAbilityEffects.some(e => e.type === 'block_action');
    const opponentBlocked = playerAbilityEffects.some(e => e.type === 'block_action');

    const resolvedPlayerAction =
      playerBlocked && playerAction === 'Attack' ? 'Defend' : playerAction;
    const resolvedOpponentAction =
      opponentBlocked && opponentAction === 'Attack' ? 'Defend' : opponentAction;

    let playerDamage = 0;
    let opponentDamage = 0;
    let forcedWinner: 'player' | 'opponent' | null = null;

    const playerActionResolved = resolvedPlayerAction;
    const opponentActionResolved = resolvedOpponentAction;

    const damageByPlayer = this.computeDamage(
      playerCard,
      playerActionResolved,
      playerMomentum,
      playerAbilityEffects
    );
    const damageByOpponent = this.computeDamage(
      opponentCard,
      opponentActionResolved,
      opponentMomentum,
      opponentAbilityEffects
    );

    opponentDamage = damageByPlayer;
    playerDamage = damageByOpponent;

    const applyDamageMultiplier = (effects: AbilityEffect[]) => {
      let multiplier = 1;
      for (const effect of effects) {
        if (effect.type === 'damage_taken_multiplier' && typeof effect.value === 'number') {
          multiplier *= effect.value;
        }
      }
      return multiplier;
    };

    const playerDamageMultiplier = applyDamageMultiplier(playerAbilityEffects);
    const opponentDamageMultiplier = applyDamageMultiplier(opponentAbilityEffects);

    playerDamage *= playerDamageMultiplier;
    opponentDamage *= opponentDamageMultiplier;

    const effectiveDamageByPlayer = opponentDamage;
    const effectiveDamageByOpponent = playerDamage;

    if (playerActionResolved === 'Charge' && opponentActionResolved === 'Charge') {
      forcedWinner = null;
    } else if (playerActionResolved === 'Attack' && opponentActionResolved === 'Attack') {
      if (effectiveDamageByPlayer > effectiveDamageByOpponent) forcedWinner = 'player';
      else if (effectiveDamageByPlayer < effectiveDamageByOpponent) forcedWinner = 'opponent';
      else forcedWinner = null;
    } else if (playerActionResolved === 'Defend' && opponentActionResolved === 'Defend') {
      // Winner = whoever takes less damage (deals more to the opponent)
      if (effectiveDamageByPlayer > effectiveDamageByOpponent) forcedWinner = 'player';
      else if (effectiveDamageByPlayer < effectiveDamageByOpponent) forcedWinner = 'opponent';
      else forcedWinner = null;
    } else if (playerActionResolved === 'Attack' && opponentActionResolved === 'Defend') {
      if (effectiveDamageByPlayer > effectiveDamageByOpponent) forcedWinner = 'player';
      else if (effectiveDamageByPlayer < effectiveDamageByOpponent) forcedWinner = 'opponent';
      else forcedWinner = null;
    } else if (playerActionResolved === 'Defend' && opponentActionResolved === 'Attack') {
      if (effectiveDamageByOpponent > effectiveDamageByPlayer) forcedWinner = 'opponent';
      else if (effectiveDamageByOpponent < effectiveDamageByPlayer) forcedWinner = 'player';
      else forcedWinner = null;
    } else if (playerActionResolved === 'Attack' && opponentActionResolved === 'Charge') {
      if (effectiveDamageByPlayer > effectiveDamageByOpponent) forcedWinner = 'player';
      else if (effectiveDamageByPlayer < effectiveDamageByOpponent) forcedWinner = 'opponent';
      else forcedWinner = 'player';
    } else if (playerActionResolved === 'Charge' && opponentActionResolved === 'Attack') {
      if (effectiveDamageByOpponent > effectiveDamageByPlayer) forcedWinner = 'opponent';
      else if (effectiveDamageByOpponent < effectiveDamageByPlayer) forcedWinner = 'player';
      else forcedWinner = 'opponent';
    } else if (playerActionResolved === 'Charge' && opponentActionResolved === 'Defend') {
      if (effectiveDamageByPlayer > effectiveDamageByOpponent) forcedWinner = 'player';
      else if (effectiveDamageByPlayer < effectiveDamageByOpponent) forcedWinner = 'opponent';
      else forcedWinner = 'opponent';
    } else if (playerActionResolved === 'Defend' && opponentActionResolved === 'Charge') {
      if (effectiveDamageByOpponent > effectiveDamageByPlayer) forcedWinner = 'opponent';
      else if (effectiveDamageByOpponent < effectiveDamageByPlayer) forcedWinner = 'player';
      else forcedWinner = 'player';
    }

    // Determine winner
    let winner: 'player' | 'opponent' | 'draw';
    if (forcedWinner) {
      winner = forcedWinner;
    } else {
      winner = 'draw';
    }

    const description = this.generateDescription(
      playerAction,
      opponentAction,
      playerDamage,
      opponentDamage
    );

    return {
      playerDamage: Math.round(playerDamage),
      opponentDamage: Math.round(opponentDamage),
      winner,
      description,
    };
  }

  private generateDescription(
    playerAction: PlayerAction,
    opponentAction: PlayerAction,
    playerDamage: number,
    opponentDamage: number
  ): string {
    if (playerDamage === 0 && opponentDamage === 0) {
      return 'Both players defended successfully!';
    }
    if (opponentDamage > playerDamage) {
      return `Your ${playerAction.toLowerCase()} dealt ${opponentDamage.toFixed(0)} damage!`;
    }
    if (playerDamage > opponentDamage) {
      return `Opponent's ${opponentAction.toLowerCase()} dealt ${playerDamage.toFixed(0)} damage!`;
    }
    return 'Equal damage exchanged!';
  }
}
