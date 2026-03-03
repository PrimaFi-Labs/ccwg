//ccwg/contracts/src/systems/match_system.cairo

use starknet::ContractAddress;

#[starknet::interface]
pub trait IMatchActions<T> {
    fn create_ranked_match(
        ref self: T,
        opponent: ContractAddress,
        deck: (u128, u128, u128),
        stake_tier: ccwg::models::StakeTier,
        total_rounds: u8
    ) -> u128;
    fn create_ai_match(ref self: T, deck: (u128, u128, u128), total_rounds: u8) -> u128;
    fn cancel_match(ref self: T, match_id: u128);
}

#[dojo::contract]
pub mod match_system {
    use super::IMatchActions;
    use ccwg::models::{Player, Card, Match, Deck, MatchMode, MatchStatus, StakeTier, StakeTierIntoU256, IdCounter};
    use dojo::model::ModelStorage;
    use dojo::event::EventStorage;
    use starknet::ContractAddress;
    use core::num::traits::Zero;

    fn next_id(ref world: dojo::world::WorldStorage) -> u128 {
        let mut counter: IdCounter = world.read_model(1);
        let new_id = counter.value + 1;
        counter.value = new_id;
        world.write_model(@counter);
        new_id
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct MatchCreatedEvent {
        #[key]
        pub match_id: u128,
        pub player_1: ContractAddress,
        pub player_2: ContractAddress,
        pub mode: MatchMode,
        pub stake_tier: StakeTier,
        pub total_rounds: u8,
        pub timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct MatchCancelledEvent {
        #[key]
        pub match_id: u128,
        pub cancelled_by: ContractAddress,
        pub timestamp: u64,
    }

    #[abi(embed_v0)]
    impl MatchActionsImpl of IMatchActions<ContractState> {
        fn create_ranked_match(
            ref self: ContractState,
            opponent: ContractAddress,
            deck: (u128, u128, u128),
            stake_tier: StakeTier,
            total_rounds: u8
        ) -> u128 {
            let mut world = self.world(@"ccwg");
            let caller = starknet::get_caller_address();

            assert(caller != opponent, 'Cannot play yourself');
            assert(total_rounds == 3 || total_rounds == 5 || total_rounds == 10, 'Invalid round count');
            assert(!opponent.is_zero(), 'Invalid opponent');

            let (c1, c2, c3) = deck;
            self._verify_card_ownership(caller, c1);
            self._verify_card_ownership(caller, c2);
            self._verify_card_ownership(caller, c3);

            let stake_amount: u256 = stake_tier.into();
            let player: Player = world.read_model(caller);
            assert(player.strk_balance >= stake_amount, 'Insufficient balance for stake');

            let match_id = next_id(ref world);
            let now = starknet::get_block_timestamp();
            let zero_address: ContractAddress = Zero::zero();

            world.write_model(@Match {
                match_id,
                player_1: caller,
                player_2: opponent,
                mode: MatchMode::Ranked1v1,
                status: MatchStatus::WaitingForOpponent,
                stake_tier,
                total_stake: stake_amount * 2,
                p1_active_card_id: c1,
                p2_active_card_id: 0,
                current_round: 0,
                total_rounds,
                p1_rounds_won: 0,
                p2_rounds_won: 0,
                winner: zero_address,
                created_at: now,
                started_at: 0,
                ended_at: 0,
            });

            world.write_model(@Deck { player: caller, match_id, card_1: c1, card_2: c2, card_3: c3, has_switched: false });

            world.emit_event(@MatchCreatedEvent { match_id, player_1: caller, player_2: opponent, mode: MatchMode::Ranked1v1, stake_tier, total_rounds, timestamp: now });

            match_id
        }

        fn create_ai_match(ref self: ContractState, deck: (u128, u128, u128), total_rounds: u8) -> u128 {
            let mut world = self.world(@"ccwg");
            let caller = starknet::get_caller_address();

            assert(total_rounds == 3 || total_rounds == 5 || total_rounds == 10, 'Invalid round count');

            let (c1, c2, c3) = deck;
            self._verify_card_ownership(caller, c1);
            self._verify_card_ownership(caller, c2);
            self._verify_card_ownership(caller, c3);

            let match_id = next_id(ref world);
            let now = starknet::get_block_timestamp();
            let ai_opponent: ContractAddress = 0x4149.try_into().unwrap();
            let zero_address: ContractAddress = Zero::zero();

            world.write_model(@Match {
                match_id,
                player_1: caller,
                player_2: ai_opponent,
                mode: MatchMode::VsAI,
                status: MatchStatus::InProgress,
                stake_tier: StakeTier::Tier10,
                total_stake: 0,
                p1_active_card_id: c1,
                p2_active_card_id: 1,
                current_round: 1,
                total_rounds,
                p1_rounds_won: 0,
                p2_rounds_won: 0,
                winner: zero_address,
                created_at: now,
                started_at: now,
                ended_at: 0,
            });

            world.write_model(@Deck { player: caller, match_id, card_1: c1, card_2: c2, card_3: c3, has_switched: false });

            world.emit_event(@MatchCreatedEvent { match_id, player_1: caller, player_2: ai_opponent, mode: MatchMode::VsAI, stake_tier: StakeTier::Tier10, total_rounds, timestamp: now });

            match_id
        }

        fn cancel_match(ref self: ContractState, match_id: u128) {
            let mut world = self.world(@"ccwg");
            let caller = starknet::get_caller_address();

            let mut game_match: Match = world.read_model(match_id);

            assert(game_match.player_1 == caller, 'Not match creator');
            assert(game_match.status == MatchStatus::WaitingForOpponent, 'Cannot cancel started match');

            game_match.status = MatchStatus::Cancelled;
            world.write_model(@game_match);

            world.emit_event(@MatchCancelledEvent { match_id, cancelled_by: caller, timestamp: starknet::get_block_timestamp() });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _verify_card_ownership(self: @ContractState, owner: ContractAddress, card_id: u128) {
            let world = self.world(@"ccwg");
            let card: Card = world.read_model((owner, card_id));
            assert(card.owner == owner, 'Card not owned');
        }
    }
}