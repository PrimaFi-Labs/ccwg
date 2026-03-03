//ccwg/contracts/src/systems/round_engine.cairo

use starknet::ContractAddress;

#[starknet::interface]
pub trait IRoundEngine<T> {
    fn start_round(ref self: T, match_id: u128) -> bool;
    fn calculate_momentum(self: @T, match_id: u128, round_number: u8, asset: ccwg::models::CardAsset) -> i128;
    fn get_round_winner(self: @T, match_id: u128, round_number: u8) -> ContractAddress;
}

#[dojo::contract]
pub mod round_engine {
    use super::IRoundEngine;
    use ccwg::models::{Match, RoundSnapshot, CardAsset, Card, MatchStatus};
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorageTrait;
    use starknet::ContractAddress;
    use ccwg::systems::oracle_system::{IOracleActionsDispatcher, IOracleActionsDispatcherTrait};
    
    #[abi(embed_v0)]
    impl RoundEngineImpl of IRoundEngine<ContractState> {
        
        fn start_round(ref self: ContractState, match_id: u128) -> bool {
            let mut world = self.world(@"ccwg");
            
            let game_match: Match = world.read_model(match_id);
            assert(game_match.status == MatchStatus::InProgress, 'Match not in progress');
            
            let round_number = game_match.current_round;
            assert(round_number <= game_match.total_rounds, 'All rounds completed');
            
            let (oracle_address, _) = world.dns(@"oracle_system").expect('Oracle system not found');
            
            let oracle_dispatcher = IOracleActionsDispatcher {
                contract_address: oracle_address
            };
            
            let snapshot_success = oracle_dispatcher.capture_round_snapshot(match_id, round_number);
            
            snapshot_success
        }
        
        fn calculate_momentum(
            self: @ContractState,
            match_id: u128,
            round_number: u8,
            asset: CardAsset
        ) -> i128 {
            let world = self.world(@"ccwg");
            
            assert(round_number >= 2, 'Need prev round');
            
            let current_snapshot: RoundSnapshot = world.read_model((match_id, round_number));
            let prev_snapshot: RoundSnapshot = world.read_model((match_id, round_number - 1));
            
            let (current_price, prev_price) = match asset {
                CardAsset::BTC => (current_snapshot.btc_price, prev_snapshot.btc_price),
                CardAsset::ETH => (current_snapshot.eth_price, prev_snapshot.eth_price),
                CardAsset::STRK => (current_snapshot.strk_price, prev_snapshot.strk_price),
                CardAsset::SOL => (current_snapshot.sol_price, prev_snapshot.sol_price),
                CardAsset::DOGE => (current_snapshot.doge_price, prev_snapshot.doge_price),
            };
            
            assert(prev_price > 0, 'Invalid previous price');
            
            let current_i128: i128 = current_price.try_into().expect('Price overflow');
            let prev_i128: i128 = prev_price.try_into().expect('Price overflow');
            
            let price_diff: i128 = current_i128 - prev_i128;
            let momentum = (price_diff * 10000) / prev_i128;
            
            momentum
        }
        
        fn get_round_winner(
            self: @ContractState,
            match_id: u128,
            round_number: u8
        ) -> ContractAddress {
            let world = self.world(@"ccwg");
            
            let game_match: Match = world.read_model(match_id);
            
            let p1_card: Card = world.read_model((game_match.player_1, game_match.p1_active_card_id));
            let p2_card: Card = world.read_model((game_match.player_2, game_match.p2_active_card_id));
            
            let p1_momentum = if round_number >= 2 {
                self.calculate_momentum(match_id, round_number, p1_card.asset)
            } else {
                0
            };
            
            let p2_momentum = if round_number >= 2 {
                self.calculate_momentum(match_id, round_number, p2_card.asset)
            } else {
                0
            };
            
            if p1_momentum > p2_momentum {
                game_match.player_1
            } else if p2_momentum > p1_momentum {
                game_match.player_2
            } else {
                if p1_card.base_power > p2_card.base_power {
                    game_match.player_1
                } else {
                    game_match.player_2
                }
            }
        }
    }
}