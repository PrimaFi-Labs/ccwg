use starknet::ContractAddress;

#[starknet::interface]
pub trait IRoomActions<T> {
    fn create_room(
        ref self: T,
        room_id: u128,
        host: ContractAddress,
        stake_fee: u256,
        max_players: u16,
        matches_per_player: u16,
        total_rounds: u8
    );
    fn join_room(ref self: T, room_id: u128, player: ContractAddress);
    fn leave_room(ref self: T, room_id: u128, player: ContractAddress);
    fn start_room(ref self: T, room_id: u128);
    fn settle_room(ref self: T, room_id: u128, winner: ContractAddress);
    fn cancel_room(ref self: T, room_id: u128);
}

#[dojo::contract]
pub mod room_system {
    use super::IRoomActions;
    use ccwg::models::{
        AuthorizedServer,
        Player,
        Room, RoomMember, RoomParticipantsList, RoomParticipantIndex, RoomSettlement, RoomStatus,
        TreasuryConfig
    };
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};

    const ROOM_FEE_BPS: u256 = 1000;
    const BPS_DENOMINATOR: u256 = 10000;

    fn assert_authorized_server(world: @dojo::world::storage::WorldStorage) {
        let server: AuthorizedServer = world.read_model(1_u8);
        assert(server.is_active, 'Server not authorized');
        assert(get_caller_address() == server.server_address, 'Only authorized server');
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct RoomCreatedEvent {
        #[key]
        pub room_id: u128,
        pub host: ContractAddress,
        pub stake_fee: u256,
        pub max_players: u16,
        pub matches_per_player: u16,
        pub total_rounds: u8,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct RoomJoinedEvent {
        #[key]
        pub room_id: u128,
        #[key]
        pub player: ContractAddress,
        pub current_players: u16,
        pub prize_pool: u256,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct RoomLeftEvent {
        #[key]
        pub room_id: u128,
        #[key]
        pub player: ContractAddress,
        pub current_players: u16,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct RoomStartedEvent {
        #[key]
        pub room_id: u128,
        pub total_players: u16,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct RoomSettledEvent {
        #[key]
        pub room_id: u128,
        pub winner: ContractAddress,
        pub treasury_fee: u256,
        pub winner_payout: u256,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct RoomCancelledEvent {
        #[key]
        pub room_id: u128,
        pub refunded_players: u16,
        pub total_refunded: u256,
    }

    #[abi(embed_v0)]
    impl RoomActionsImpl of IRoomActions<ContractState> {
        fn create_room(
            ref self: ContractState,
            room_id: u128,
            host: ContractAddress,
            stake_fee: u256,
            max_players: u16,
            matches_per_player: u16,
            total_rounds: u8
        ) {
            let mut world = self.world(@"ccwg");
            assert_authorized_server(@world);

            assert(room_id > 0_u128, 'Invalid room id');
            assert(max_players >= 2, 'Min 2 players');
            assert(max_players <= 16, 'Max 16 players');
            assert(matches_per_player >= 1, 'Matches/player too low');
            assert(matches_per_player <= 50, 'Matches/player too high');
            assert(total_rounds == 3 || total_rounds == 5 || total_rounds == 10, 'Invalid rounds');

            // Dojo 1.8: read_model returns key fields populated from the query,
            // so checking room_id == 0 always fails.  Check a non-key field instead.
            let zero_address: ContractAddress = 0.try_into().unwrap();
            let existing: Room = world.read_model(room_id);
            assert(existing.host == zero_address, 'Room already exists');

            let now = get_block_timestamp();
            world.write_model(
                @Room {
                    room_id,
                    host,
                    stake_fee,
                    max_players,
                    current_players: 0,
                    matches_per_player,
                    total_rounds,
                    prize_pool: 0,
                    status: RoomStatus::Open,
                    created_at: now,
                    starts_at: 0,
                    ends_at: 0
                }
            );
            world.write_model(@RoomParticipantsList { room_id, participants_count: 0 });

            world.emit_event(
                @RoomCreatedEvent {
                    room_id,
                    host,
                    stake_fee,
                    max_players,
                    matches_per_player,
                    total_rounds
                }
            );
        }

        fn join_room(ref self: ContractState, room_id: u128, player: ContractAddress) {
            let mut world = self.world(@"ccwg");
            assert_authorized_server(@world);

            let zero_address: ContractAddress = 0.try_into().unwrap();
            let mut room: Room = world.read_model(room_id);
            assert(room.host != zero_address, 'Room not found');
            assert(room.status == RoomStatus::Open, 'Room not open');
            assert(room.current_players < room.max_players, 'Room full');

            // ── Debit the player's internal deposited STRK balance ──
            let mut player_data: Player = world.read_model(player);
            assert(player_data.strk_balance >= room.stake_fee, 'Insufficient STRK balance');
            player_data.strk_balance -= room.stake_fee;
            world.write_model(@player_data);

            let mut existing: RoomMember = world.read_model((room_id, player));
            if existing.joined_at == 0 {
                let now = get_block_timestamp();
                existing = RoomMember {
                    room_id,
                    player,
                    stake_paid: room.stake_fee,
                    is_active: true,
                    joined_at: now
                };

                let mut participants_list: RoomParticipantsList = world.read_model(room_id);
                let participant_index = participants_list.participants_count;
                participants_list.participants_count += 1;
                world.write_model(@participants_list);

                world.write_model(
                    @RoomParticipantIndex {
                        room_id,
                        index: participant_index,
                        player
                    }
                );
            } else {
                assert(existing.player == player, 'Invalid participant');
                assert(!existing.is_active, 'Already in room');
                existing.is_active = true;
                existing.stake_paid += room.stake_fee;
                existing.joined_at = get_block_timestamp();
            }

            world.write_model(@existing);

            room.current_players += 1;
            room.prize_pool += room.stake_fee;
            world.write_model(@room);

            world.emit_event(
                @RoomJoinedEvent {
                    room_id,
                    player,
                    current_players: room.current_players,
                    prize_pool: room.prize_pool
                }
            );
        }

        fn leave_room(ref self: ContractState, room_id: u128, player: ContractAddress) {
            let mut world = self.world(@"ccwg");
            assert_authorized_server(@world);

            let zero_address: ContractAddress = 0.try_into().unwrap();
            let mut room: Room = world.read_model(room_id);
            assert(room.host != zero_address, 'Room not found');
            assert(room.status == RoomStatus::Open || room.status == RoomStatus::InProgress, 'Room ended');

            let mut member: RoomMember = world.read_model((room_id, player));
            assert(member.joined_at != 0, 'Member not found');
            assert(member.is_active, 'Already inactive');

            member.is_active = false;
            world.write_model(@member);

            // ── Refund the player's internal STRK balance ────────────
            let mut player_data: Player = world.read_model(player);
            player_data.strk_balance += member.stake_paid;
            world.write_model(@player_data);

            if room.current_players > 0_u16 {
                room.current_players -= 1;
            }
            if room.prize_pool >= member.stake_paid {
                room.prize_pool -= member.stake_paid;
            } else {
                room.prize_pool = 0;
            }
            world.write_model(@room);

            world.emit_event(
                @RoomLeftEvent {
                    room_id,
                    player,
                    current_players: room.current_players
                }
            );
        }

        fn start_room(ref self: ContractState, room_id: u128) {
            let mut world = self.world(@"ccwg");
            assert_authorized_server(@world);

            let zero_address: ContractAddress = 0.try_into().unwrap();
            let mut room: Room = world.read_model(room_id);
            assert(room.host != zero_address, 'Room not found');
            assert(room.status == RoomStatus::Open, 'Room not open');
            assert(room.current_players >= 2, 'Need at least 2 players');

            room.status = RoomStatus::InProgress;
            room.starts_at = get_block_timestamp();
            world.write_model(@room);

            world.emit_event(
                @RoomStartedEvent {
                    room_id,
                    total_players: room.current_players
                }
            );
        }

        fn settle_room(ref self: ContractState, room_id: u128, winner: ContractAddress) {
            let mut world = self.world(@"ccwg");
            assert_authorized_server(@world);

            let zero_address: ContractAddress = 0.try_into().unwrap();
            let mut room: Room = world.read_model(room_id);
            assert(room.host != zero_address, 'Room not found');
            assert(room.status == RoomStatus::Open || room.status == RoomStatus::InProgress, 'Room already ended');

            let existing_settlement: RoomSettlement = world.read_model(room_id);
            assert(existing_settlement.settled_at == 0, 'Room already settled');

            let treasury_fee = (room.prize_pool * ROOM_FEE_BPS) / BPS_DENOMINATOR;
            let winner_payout = room.prize_pool - treasury_fee;
            let now = get_block_timestamp();

            // ── Credit winner's internal STRK balance ────────────────
            let zero_winner: ContractAddress = 0.try_into().unwrap();
            if winner != zero_winner && winner_payout > 0 {
                let mut winner_data: Player = world.read_model(winner);
                winner_data.strk_balance += winner_payout;
                world.write_model(@winner_data);
            }

            let mut treasury: TreasuryConfig = world.read_model(1_u8);
            treasury.accrued_fees += treasury_fee;
            treasury.updated_at = now;
            world.write_model(@treasury);

            room.status = RoomStatus::Completed;
            room.ends_at = now;
            world.write_model(@room);

            world.write_model(
                @RoomSettlement {
                    room_id,
                    winner,
                    treasury_fee,
                    winner_payout,
                    settled_at: now
                }
            );

            world.emit_event(
                @RoomSettledEvent {
                    room_id,
                    winner,
                    treasury_fee,
                    winner_payout
                }
            );
        }

        fn cancel_room(ref self: ContractState, room_id: u128) {
            let mut world = self.world(@"ccwg");
            assert_authorized_server(@world);

            let zero_address: ContractAddress = 0.try_into().unwrap();
            let mut room: Room = world.read_model(room_id);
            assert(room.host != zero_address, 'Room not found');
            assert(room.status == RoomStatus::Open || room.status == RoomStatus::InProgress, 'Room already ended');

            let participants_list: RoomParticipantsList = world.read_model(room_id);
            let mut i: u16 = 0;
            let mut refunded_players: u16 = 0;
            let mut total_refunded: u256 = 0;

            loop {
                if i >= participants_list.participants_count {
                    break;
                }

                let participant_index: RoomParticipantIndex = world.read_model((room_id, i));
                let participant = participant_index.player;
                let mut member: RoomMember = world.read_model((room_id, participant));
                if member.is_active {
                    // ── Refund each active member's internal balance ──
                    let mut player_data: Player = world.read_model(participant);
                    player_data.strk_balance += member.stake_paid;
                    world.write_model(@player_data);

                    refunded_players += 1;
                    total_refunded += member.stake_paid;
                    member.is_active = false;
                    world.write_model(@member);
                }

                i += 1;
            };

            room.status = RoomStatus::Cancelled;
            room.ends_at = get_block_timestamp();
            room.prize_pool = 0;
            room.current_players = 0;
            world.write_model(@room);

            world.emit_event(
                @RoomCancelledEvent {
                    room_id,
                    refunded_players,
                    total_refunded
                }
            );
        }
    }
}
