//ccwg/ccwg-web/src/config/abilities.ts

import type { Ability } from '@/src/types/database';

export const DEFAULT_ABILITIES: Record<string, Omit<Ability, 'created_at' | 'updated_at'>> = {
  btc_halving_pressure: {
    ability_id: 'btc_halving_pressure',
    name: 'HALVING PRESSURE',
    description: 'Opponent damage halved for the round',
    trigger_type: 'charge_triggered',
    effect_type: 'momentum_amplifier',
    config: {
      damage_multiplier: 0.5,
    },
    usage_limit: 'once_per_match',
  },
  strk_zk_cloak: {
    ability_id: 'strk_zk_cloak',
    name: 'ZK-CLOAK',
    description: 'Opponent sees only their own data for 2 rounds',
    trigger_type: 'charge_triggered',
    effect_type: 'visibility_denial',
    config: {
      cloak_rounds: 2,
    },
    usage_limit: 'once_per_match',
  },
  doge_loyal_guard: {
    ability_id: 'doge_loyal_guard',
    name: 'LOYAL GUARD',
    description: 'If opponent attacks, their damage is reduced by 25%',
    trigger_type: 'charge_triggered',
    effect_type: 'defensive_reflect',
    config: {
      attack_damage_multiplier: 0.75,
    },
    usage_limit: 'once_per_match',
  },
  sol_desync: {
    ability_id: 'sol_desync',
    name: 'DE-SYNC',
    description: 'Opponent cannot swap or Charge next round',
    trigger_type: 'charge_triggered',
    effect_type: 'action_lock',
    config: {
      disable_swap: true,
      disable_charge: true,
      duration_rounds: 1,
    },
    usage_limit: 'once_per_match',
  },
  eth_gas_surge: {
    ability_id: 'eth_gas_surge',
    name: 'GAS SURGE',
    description: 'If momentum is negative, opponent damage reduced by 20%',
    trigger_type: 'charge_triggered',
    effect_type: 'momentum_stabilizer',
    config: {
      damage_multiplier: 0.8,
    },
    usage_limit: 'once_per_match',
  },
};
