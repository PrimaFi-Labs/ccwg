//ccwg/contracts/src/systems/event_system.cairo

use starknet::ContractAddress;

#[starknet::interface]
pub trait IEventActions<T> {
    fn create_event(
        ref self: T,
        event_name: felt252,
        entry_fee: u256,
        max_players: u16,
        starts_at: u64,
        prize_distribution: (u16, u16, u16)
    ) -> u128;
    fn join_event(ref self: T, event_id: u128, deck: (u128, u128, u128));
    fn start_event(ref self: T, event_id: u128);
    fn finalize_event(
        ref self: T,
        event_id: u128,
        rankings: Array<ContractAddress>,
        signature: Array<felt252>
    );
    fn cancel_event(ref self: T, event_id: u128);
}

#[dojo::contract]
pub mod event_system {
    use super::IEventActions;
    use ccwg::models::{
        GameEvent, EventParticipant, EventParticipantsList, EventParticipantIndex,
        EventPrizeDistribution, EventStatus, Player, IdCounter, AuthorizedServer, TreasuryConfig
    };
    use dojo::model::ModelStorage;
    use dojo::event::EventStorage;
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use core::poseidon::poseidon_hash_span;

    const PLATFORM_FEE_BPS: u256 = 500;
    const BPS_DENOMINATOR: u256 = 10000;

    #[starknet::interface]
    trait IAccount<TContractState> {
        fn is_valid_signature(
            self: @TContractState,
            hash: felt252,
            signature: Array<felt252>
        ) -> felt252;
    }

    const VALIDATED: felt252 = 'VALID';

    fn assert_authorized_server(world: @dojo::world::storage::WorldStorage) -> AuthorizedServer {
        let server: AuthorizedServer = world.read_model(1_u8);
        assert(server.is_active, 'Server not authorized');
        assert(get_caller_address() == server.server_address, 'Only authorized server');
        server
    }

    fn next_event_id(ref world: dojo::world::storage::WorldStorage) -> u128 {
        let mut counter: IdCounter = world.read_model(2);
        let new_id = counter.value + 1;
        counter.value = new_id;
        world.write_model(@counter);
        new_id
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct EventCreatedEvent {
        #[key]
        pub event_id: u128,
        pub event_name: felt252,
        pub entry_fee: u256,
        pub max_players: u16,
        pub starts_at: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct PlayerJoinedEventEvent {
        #[key]
        pub event_id: u128,
        #[key]
        pub player: ContractAddress,
        pub current_players: u16,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct EventStartedEvent {
        #[key]
        pub event_id: u128,
        pub total_players: u16,
        pub prize_pool: u256,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct EventFinalizedEvent {
        #[key]
        pub event_id: u128,
        pub first_place: ContractAddress,
        pub second_place: ContractAddress,
        pub third_place: ContractAddress,
        pub prize_pool_distributed: u256,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct EventCancelledEvent {
        #[key]
        pub event_id: u128,
        pub refunded_players: u16,
        pub total_refunded: u256,
    }

    #[abi(embed_v0)]
    impl EventActionsImpl of IEventActions<ContractState> {
        
        fn create_event(
            ref self: ContractState,
            event_name: felt252,
            entry_fee: u256,
            max_players: u16,
            starts_at: u64,
            prize_distribution: (u16, u16, u16)
        ) -> u128 {
            let mut world = self.world(@"ccwg");
            assert_authorized_server(@world);
            
            assert(max_players >= 3, 'Min 3 players');
            assert(max_players <= 50, 'Max 50 players');
            
            let (first, second, third) = prize_distribution;
            assert(first + second + third == 10000, 'Prize % must = 100%');
            
            let event_id = next_event_id(ref world);
            let now = get_block_timestamp();
            
            world.write_model(
                @GameEvent {
                    event_id,
                    event_name,
                    entry_fee,
                    max_players,
                    current_players: 0,
                    prize_pool: 0,
                    status: EventStatus::Open,
                    created_at: now,
                    starts_at,
                    ends_at: 0
                }
            );
            
            world.write_model(
                @EventPrizeDistribution {
                    event_id,
                    first_place_percent: first,
                    second_place_percent: second,
                    third_place_percent: third
                }
            );
            
            world.write_model(
                @EventParticipantsList {
                    event_id,
                    participants_count: 0
                }
            );
            
            world.emit_event(
                @EventCreatedEvent {
                    event_id,
                    event_name,
                    entry_fee,
                    max_players,
                    starts_at
                }
            );
            
            event_id
        }
        
        fn join_event(ref self: ContractState, event_id: u128, deck: (u128, u128, u128)) {
            let mut world = self.world(@"ccwg");
            let caller = get_caller_address();
            let now = get_block_timestamp();
            
            let mut game_event: GameEvent = world.read_model(event_id);
            assert(game_event.status == EventStatus::Open, 'Event not open');
            assert(game_event.current_players < game_event.max_players, 'Event full');
            assert(now < game_event.starts_at, 'Event already started');
            
            let mut player: Player = world.read_model(caller);
            assert(player.strk_balance >= game_event.entry_fee, 'Insufficient balance');
            
            player.strk_balance -= game_event.entry_fee;
            world.write_model(@player);
            
            game_event.prize_pool += game_event.entry_fee;
            game_event.current_players += 1;
            world.write_model(@game_event);
            
            // Add to participants list with index
            let mut participants_list: EventParticipantsList = world.read_model(event_id);
            let participant_index = participants_list.participants_count;
            participants_list.participants_count += 1;
            world.write_model(@participants_list);
            
            // Store participant index mapping
            world.write_model(
                @EventParticipantIndex {
                    event_id,
                    index: participant_index,
                    player: caller
                }
            );
            
            world.write_model(
                @EventParticipant {
                    event_id,
                    player: caller,
                    deck,
                    final_rank: 0,
                    prize_won: 0,
                    joined_at: now
                }
            );
            
            world.emit_event(
                @PlayerJoinedEventEvent {
                    event_id,
                    player: caller,
                    current_players: game_event.current_players
                }
            );
        }
        
        fn start_event(ref self: ContractState, event_id: u128) {
            let mut world = self.world(@"ccwg");
            assert_authorized_server(@world);
            let now = get_block_timestamp();
            
            let mut game_event: GameEvent = world.read_model(event_id);
            assert(game_event.status == EventStatus::Open, 'Event not open');
            assert(now >= game_event.starts_at, 'Event not started yet');
            assert(game_event.current_players >= 3, 'Need min 3 players');
            
            game_event.status = EventStatus::InProgress;
            world.write_model(@game_event);
            
            world.emit_event(
                @EventStartedEvent {
                    event_id,
                    total_players: game_event.current_players,
                    prize_pool: game_event.prize_pool
                }
            );
        }
        
        fn finalize_event(
            ref self: ContractState,
            event_id: u128,
            rankings: Array<ContractAddress>,
            signature: Array<felt252>
        ) {
            let mut world = self.world(@"ccwg");
            
            let mut game_event: GameEvent = world.read_model(event_id);
            assert(game_event.status == EventStatus::InProgress, 'Event not in progress');
            
            let authorized_server = assert_authorized_server(@world);
            
            let mut message_data = array![event_id.into()];
            let mut i = 0;
            loop {
                if i >= rankings.len() {
                    break;
                }
                message_data.append((*rankings.at(i)).into());
                i += 1;
            };
            
            let message_hash = poseidon_hash_span(message_data.span());
            
            let server_account = IAccountDispatcher {
                contract_address: authorized_server.server_address
            };
            
            let validation_result = server_account.is_valid_signature(message_hash, signature);
            assert(validation_result == VALIDATED, 'Invalid signature');
            
            let prize_dist: EventPrizeDistribution = world.read_model(event_id);
            let total_pool = game_event.prize_pool;
            let platform_fee = (total_pool * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
            let net_pool = total_pool - platform_fee;

            let mut treasury: TreasuryConfig = world.read_model(1_u8);
            treasury.accrued_fees += platform_fee;
            treasury.updated_at = get_block_timestamp();
            world.write_model(@treasury);
            
            let first_prize = (net_pool * prize_dist.first_place_percent.into()) / BPS_DENOMINATOR;
            let second_prize = (net_pool * prize_dist.second_place_percent.into()) / BPS_DENOMINATOR;
            let third_prize = (net_pool * prize_dist.third_place_percent.into()) / BPS_DENOMINATOR;
            
            if rankings.len() >= 1 {
                let p1 = *rankings.at(0);
                let mut player1: Player = world.read_model(p1);
                player1.strk_balance += first_prize;
                player1.wins += 1;
                player1.total_xp += 500;
                world.write_model(@player1);
                
                let mut participant1: EventParticipant = world.read_model((event_id, p1));
                participant1.final_rank = 1;
                participant1.prize_won = first_prize;
                world.write_model(@participant1);
            }
            
            if rankings.len() >= 2 {
                let p2 = *rankings.at(1);
                let mut player2: Player = world.read_model(p2);
                player2.strk_balance += second_prize;
                player2.total_xp += 300;
                world.write_model(@player2);
                
                let mut participant2: EventParticipant = world.read_model((event_id, p2));
                participant2.final_rank = 2;
                participant2.prize_won = second_prize;
                world.write_model(@participant2);
            }
            
            if rankings.len() >= 3 {
                let p3 = *rankings.at(2);
                let mut player3: Player = world.read_model(p3);
                player3.strk_balance += third_prize;
                player3.total_xp += 150;
                world.write_model(@player3);
                
                let mut participant3: EventParticipant = world.read_model((event_id, p3));
                participant3.final_rank = 3;
                participant3.prize_won = third_prize;
                world.write_model(@participant3);
            }
            
            game_event.status = EventStatus::Completed;
            game_event.ends_at = get_block_timestamp();
            world.write_model(@game_event);
            
            world.emit_event(
                @EventFinalizedEvent {
                    event_id,
                    first_place: *rankings.at(0),
                    second_place: *rankings.at(1),
                    third_place: *rankings.at(2),
                    prize_pool_distributed: net_pool
                }
            );
        }
        
        fn cancel_event(ref self: ContractState, event_id: u128) {
            let mut world = self.world(@"ccwg");
            assert_authorized_server(@world);
            
            let mut game_event: GameEvent = world.read_model(event_id);
            assert(game_event.status == EventStatus::Open, 'Event not open');
            
            // Iterate through all participants and refund
            let participants_list: EventParticipantsList = world.read_model(event_id);
            let total_participants = participants_list.participants_count;
            
            let mut i: u16 = 0;
            let mut total_refunded: u256 = 0;
            
            loop {
                if i >= total_participants {
                    break;
                }
                
                // Get participant address from index
                let participant_index: EventParticipantIndex = world.read_model((event_id, i));
                let participant_address = participant_index.player;
                
                // Refund the player
                let mut player: Player = world.read_model(participant_address);
                player.strk_balance += game_event.entry_fee;
                world.write_model(@player);
                
                total_refunded += game_event.entry_fee;
                i += 1;
            };
            
            game_event.status = EventStatus::Cancelled;
            game_event.prize_pool = 0;
            world.write_model(@game_event);
            
            world.emit_event(
                @EventCancelledEvent {
                    event_id,
                    refunded_players: total_participants,
                    total_refunded
                }
            );
        }
    }
}
