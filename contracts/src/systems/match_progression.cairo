//ccwg/contracts/src/systems/match_progression.cairo

use starknet::ContractAddress;

#[starknet::interface]
pub trait IMatchProgression<T> {
    fn advance_round(ref self: T, match_id: u128, round_winner: ContractAddress);
    fn finalize_match(ref self: T, match_id: u128);
}

#[dojo::contract]
pub mod match_progression {
    use super::IMatchProgression;
    use ccwg::models::{Match, MatchStatus};
    use dojo::model::ModelStorage;
    use dojo::event::EventStorage;
    use starknet::ContractAddress;
    use core::num::traits::Zero;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct RoundCompletedEvent {
        #[key]
        pub match_id: u128,
        pub round_number: u8,
        pub winner: ContractAddress,
        pub p1_rounds_won: u8,
        pub p2_rounds_won: u8,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct MatchCompletedEvent {
        #[key]
        pub match_id: u128,
        pub winner: ContractAddress,
        pub final_score: (u8, u8),
        pub duration: u64,
    }

    #[abi(embed_v0)]
    impl MatchProgressionImpl of IMatchProgression<ContractState> {
        
        fn advance_round(ref self: ContractState, match_id: u128, round_winner: ContractAddress) {
            let mut world = self.world(@"ccwg");
            
            let mut game_match: Match = world.read_model(match_id);
            assert(game_match.status == MatchStatus::InProgress, 'Match not in progress');
            
            if round_winner == game_match.player_1 {
                game_match.p1_rounds_won += 1;
            } else if round_winner == game_match.player_2 {
                game_match.p2_rounds_won += 1;
            }
            
            world.emit_event(
                @RoundCompletedEvent {
                    match_id,
                    round_number: game_match.current_round,
                    winner: round_winner,
                    p1_rounds_won: game_match.p1_rounds_won,
                    p2_rounds_won: game_match.p2_rounds_won
                }
            );
            
            let rounds_to_win = (game_match.total_rounds / 2) + 1;
            
            if game_match.p1_rounds_won >= rounds_to_win {
                self._complete_match(ref world, ref game_match, game_match.player_1);
            } else if game_match.p2_rounds_won >= rounds_to_win {
                self._complete_match(ref world, ref game_match, game_match.player_2);
            } else {
                game_match.current_round += 1;
                world.write_model(@game_match);
            }
        }
        
        fn finalize_match(ref self: ContractState, match_id: u128) {
            let mut world = self.world(@"ccwg");
            let mut game_match: Match = world.read_model(match_id);
            
            assert(game_match.status == MatchStatus::InProgress, 'Match not in progress');
            
            let zero_address: ContractAddress = Zero::zero();
            
            let winner = if game_match.p1_rounds_won > game_match.p2_rounds_won {
                game_match.player_1
            } else if game_match.p2_rounds_won > game_match.p1_rounds_won {
                game_match.player_2
            } else {
                zero_address
            };
            
            self._complete_match(ref world, ref game_match, winner);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _complete_match(
            self: @ContractState,
            ref world: dojo::world::WorldStorage,
            ref game_match: Match,
            winner: ContractAddress
        ) {
            game_match.status = MatchStatus::Completed;
            game_match.winner = winner;
            game_match.ended_at = starknet::get_block_timestamp();
            
            let duration = game_match.ended_at - game_match.started_at;
            
            world.write_model(@game_match);
            
            world.emit_event(
                @MatchCompletedEvent {
                    match_id: game_match.match_id,
                    winner,
                    final_score: (game_match.p1_rounds_won, game_match.p2_rounds_won),
                    duration
                }
            );
        }
    }
}