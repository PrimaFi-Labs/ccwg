//ccwg/contracts/src/systems/combat_system.cairo

use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Introspect)]
pub struct CombatResult {
    pub attacker: ContractAddress,
    pub defender: ContractAddress,
    pub damage_dealt: u32,
    pub defender_hp_remaining: u32,
    pub is_critical: bool,
}

#[starknet::interface]
pub trait ICombatSystem<T> {
    fn calculate_damage(
        self: @T,
        attacker_power: u32,
        defender_defense: u32,
        momentum: i128,
        action: ccwg::models::PlayerAction,
        ability_multiplier: u32
    ) -> u32;
    fn resolve_round_combat(
        ref self: T,
        match_id: u128,
        round_number: u8,
        p1_action: ccwg::models::PlayerAction,
        p2_action: ccwg::models::PlayerAction,
        p1_ability_active: bool,
        p2_ability_active: bool
    ) -> CombatResult;
}

#[dojo::contract]
pub mod combat_system {
    use super::{ICombatSystem, CombatResult};
    use ccwg::models::{Match, Card, PlayerAction, RoundSnapshot, CardAsset};
    use dojo::model::ModelStorage;

    // Damage formula constants
    const BASE_DAMAGE_MULTIPLIER: u32 = 100;
    const DEFEND_REDUCTION: u32 = 50;
    const CHARGE_DAMAGE_PENALTY: u32 = 25;
    const ABILITY_BOOST: u32 = 150;

    #[abi(embed_v0)]
    impl CombatSystemImpl of ICombatSystem<ContractState> {
        
        fn calculate_damage(
            self: @ContractState,
            attacker_power: u32,
            defender_defense: u32,
            momentum: i128,
            action: PlayerAction,
            ability_multiplier: u32
        ) -> u32 {
            let base_dmg = if attacker_power > (defender_defense / 2) {
                attacker_power - (defender_defense / 2)
            } else {
                1
            };
            
            let momentum_mod: i128 = 10000 + momentum;
            let with_momentum = (base_dmg.into() * momentum_mod) / 10000;
            
            let with_action = match action {
                PlayerAction::Attack => with_momentum,
                PlayerAction::Defend => with_momentum * DEFEND_REDUCTION.into() / 100,
                PlayerAction::Charge => with_momentum * CHARGE_DAMAGE_PENALTY.into() / 100,
                PlayerAction::UseAbility => with_momentum * ability_multiplier.into() / 100,
                PlayerAction::NoAction => with_momentum / 2,
            };
            
            if with_action > 0 {
                with_action.try_into().unwrap()
            } else {
                1
            }
        }
        
        fn resolve_round_combat(
            ref self: ContractState,
            match_id: u128,
            round_number: u8,
            p1_action: PlayerAction,
            p2_action: PlayerAction,
            p1_ability_active: bool,
            p2_ability_active: bool
        ) -> CombatResult {
            let mut world = self.world(@"ccwg");
            
            let game_match: Match = world.read_model(match_id);
            
            let p1_card: Card = world.read_model((game_match.player_1, game_match.p1_active_card_id));
            let p2_card: Card = world.read_model((game_match.player_2, game_match.p2_active_card_id));
            
            let p1_momentum = if round_number >= 2 {
                self._calculate_momentum_inline(match_id, round_number, p1_card.asset, ref world)
            } else {
                0
            };
            
            let p2_momentum = if round_number >= 2 {
                self._calculate_momentum_inline(match_id, round_number, p2_card.asset, ref world)
            } else {
                0
            };
            
            let p1_ability_mult = if p1_ability_active { ABILITY_BOOST } else { BASE_DAMAGE_MULTIPLIER };
            let p1_damage = self.calculate_damage(
                p1_card.base_power,
                p2_card.base_defense,
                p1_momentum,
                p1_action,
                p1_ability_mult
            );
            
            let p2_ability_mult = if p2_ability_active { ABILITY_BOOST } else { BASE_DAMAGE_MULTIPLIER };
            let p2_damage = self.calculate_damage(
                p2_card.base_power,
                p1_card.base_defense,
                p2_momentum,
                p2_action,
                p2_ability_mult
            );
            
            let (winner, damage, is_crit) = if p1_damage > p2_damage {
                (game_match.player_1, p1_damage, p1_ability_active)
            } else {
                (game_match.player_2, p2_damage, p2_ability_active)
            };
            
            CombatResult {
                attacker: winner,
                defender: if winner == game_match.player_1 { game_match.player_2 } else { game_match.player_1 },
                damage_dealt: damage,
                defender_hp_remaining: 800,
                is_critical: is_crit
            }
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _calculate_momentum_inline(
            self: @ContractState,
            match_id: u128,
            round_number: u8,
            asset: CardAsset,
            ref world: dojo::world::storage::WorldStorage
        ) -> i128 {
            let current_snapshot: RoundSnapshot = world.read_model((match_id, round_number));
            let prev_snapshot: RoundSnapshot = world.read_model((match_id, round_number - 1));
            
            let current_price = match asset {
                CardAsset::BTC => current_snapshot.btc_price,
                CardAsset::ETH => current_snapshot.eth_price,
                CardAsset::STRK => current_snapshot.strk_price,
                CardAsset::SOL => current_snapshot.sol_price,
                CardAsset::DOGE => current_snapshot.doge_price,
            };
            
            let prev_price = match asset {
                CardAsset::BTC => prev_snapshot.btc_price,
                CardAsset::ETH => prev_snapshot.eth_price,
                CardAsset::STRK => prev_snapshot.strk_price,
                CardAsset::SOL => prev_snapshot.sol_price,
                CardAsset::DOGE => prev_snapshot.doge_price,
            };
            
            if prev_price == 0 {
                return 0;
            }
            
            if current_price >= prev_price {
                // Positive momentum
                let price_increase = current_price - prev_price;
                let momentum_u128: u128 = ((price_increase.into() * 10000_u256) / prev_price.into()).try_into().unwrap();
                
                // Cap momentum at i128::MAX to prevent overflow
                if momentum_u128 > 170141183460469231731687303715884105727_u128 {
                    170141183460469231731687303715884105727  // i128::MAX
                } else {
                    momentum_u128.try_into().unwrap()
                }
            } else {
                // Negative momentum
                let price_decrease = prev_price - current_price;
                let momentum_u128: u128 = ((price_decrease.into() * 10000_u256) / prev_price.into()).try_into().unwrap();
                
                // Cap momentum at i128::MAX to prevent overflow, then negate
                if momentum_u128 > 170141183460469231731687303715884105727_u128 {
                    -170141183460469231731687303715884105727  // -i128::MAX
                } else {
                    let positive: i128 = momentum_u128.try_into().unwrap();
                    -positive
                }
            }
        }
    }
}