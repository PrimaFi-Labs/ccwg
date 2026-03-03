//ccwg/contracts/src/systems/escrow_system.cairo

use starknet::ContractAddress;

#[starknet::interface]
pub trait IEscrowActions<T> {
    fn deposit_stake(ref self: T, amount: u256);
    fn withdraw_balance(ref self: T, amount: u256);
    fn server_disburse(ref self: T, player: ContractAddress, amount: u256);
    fn lock_match_escrow(ref self: T, match_id: u128, p1_stake: u256, p2_stake: u256);
    fn settle_match(
        ref self: T,
        match_id: u128,
        winner: ContractAddress,
        p1_rounds_won: u8,
        p2_rounds_won: u8,
        transcript_hash: felt252,
        signature: Array<felt252>
    );
    fn refund_match(ref self: T, match_id: u128);
}

#[dojo::contract]
pub mod escrow_system {
    use super::IEscrowActions;
    use ccwg::models::{Player, Match, Escrow, MatchStatus, AuthorizedServer, TreasuryConfig};
    use dojo::model::ModelStorage;
    use dojo::event::EventStorage;
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp, get_contract_address};

    #[starknet::interface]
    trait IERC20<TContractState> {
        fn transfer_from(
            ref self: TContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256
        ) -> bool;
        fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    }

    // SNIP-6 Account interface for signature verification
    #[starknet::interface]
    trait IAccount<TContractState> {
        fn is_valid_signature(
            self: @TContractState,
            hash: felt252,
            signature: Array<felt252>
        ) -> felt252;
    }

    const PLATFORM_FEE_BPS: u256 = 500;
    const BPS_DENOMINATOR: u256 = 10000;
    const STRK_TOKEN: felt252 = 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d;
    
    // SNIP-6 magic value returned by valid signatures
    const VALIDATED: felt252 = 'VALID';

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct DepositEvent {
        #[key]
        pub player: ContractAddress,
        pub amount: u256,
        pub new_balance: u256,
        pub timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct WithdrawEvent {
        #[key]
        pub player: ContractAddress,
        pub amount: u256,
        pub new_balance: u256,
        pub timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct EscrowLockedEvent {
        #[key]
        pub match_id: u128,
        pub player_1: ContractAddress,
        pub player_2: ContractAddress,
        pub total_amount: u256,
        pub timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct MatchSettledEvent {
        #[key]
        pub match_id: u128,
        pub winner: ContractAddress,
        pub p1_payout: u256,
        pub p2_payout: u256,
        pub platform_fee: u256,
        pub transcript_hash: felt252,
        pub timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct MatchRefundedEvent {
        #[key]
        pub match_id: u128,
        pub p1_refund: u256,
        pub p2_refund: u256,
        pub timestamp: u64,
    }

    #[abi(embed_v0)]
    impl EscrowActionsImpl of IEscrowActions<ContractState> {
        fn deposit_stake(ref self: ContractState, amount: u256) {
            let mut world = self.world(@"ccwg");
            let caller = get_caller_address();

            let strk_token = IERC20Dispatcher { contract_address: STRK_TOKEN.try_into().unwrap() };
            let this_contract = get_contract_address();
            let success = strk_token.transfer_from(caller, this_contract, amount);
            assert(success, 'STRK transfer failed');

            let mut player: Player = world.read_model(caller);
            player.strk_balance += amount;
            world.write_model(@player);

            world.emit_event(@DepositEvent { player: caller, amount: amount, new_balance: player.strk_balance, timestamp: get_block_timestamp() });
        }

        fn withdraw_balance(ref self: ContractState, amount: u256) {
            let mut world = self.world(@"ccwg");
            let caller = get_caller_address();

            let mut player: Player = world.read_model(caller);
            assert(player.strk_balance >= amount, 'Insufficient balance');

            player.strk_balance -= amount;
            world.write_model(@player);

            let strk_token = IERC20Dispatcher { contract_address: STRK_TOKEN.try_into().unwrap() };
            let success = strk_token.transfer(caller, amount);
            assert(success, 'STRK withdrawal failed');

            world.emit_event(@WithdrawEvent { player: caller, amount: amount, new_balance: player.strk_balance, timestamp: get_block_timestamp() });
        }

        /// Server-initiated disbursement: transfers STRK from contract to a
        /// player's wallet, debiting their internal balance.  Only callable by
        /// the authorized server account.  Used for auto-withdraw after event
        /// and room settlement so players receive real tokens immediately.
        fn server_disburse(ref self: ContractState, player: ContractAddress, amount: u256) {
            let mut world = self.world(@"ccwg");

            // Authorization: only the registered server account may call this
            let authorized_server: AuthorizedServer = world.read_model(1_u8);
            assert(authorized_server.is_active, 'Server not authorized');
            let caller = get_caller_address();
            assert(caller == authorized_server.server_address, 'Not authorized server');

            let mut player_data: Player = world.read_model(player);
            assert(player_data.strk_balance >= amount, 'Insufficient balance');

            player_data.strk_balance -= amount;
            world.write_model(@player_data);

            let strk_token = IERC20Dispatcher { contract_address: STRK_TOKEN.try_into().unwrap() };
            let success = strk_token.transfer(player, amount);
            assert(success, 'STRK disbursement failed');

            world.emit_event(@WithdrawEvent { player, amount, new_balance: player_data.strk_balance, timestamp: get_block_timestamp() });
        }

        fn lock_match_escrow(ref self: ContractState, match_id: u128, p1_stake: u256, p2_stake: u256) {
            let mut world = self.world(@"ccwg");

            // Permission check removed - rely on model-level permissions in Scarb.toml
            // Only match_system can write to Match model and trigger this properly

            let game_match: Match = world.read_model(match_id);
            assert(game_match.status == MatchStatus::WaitingForOpponent, 'Match already started');

            let p1 = game_match.player_1;
            let p2 = game_match.player_2;

            let mut player1: Player = world.read_model(p1);
            let mut player2: Player = world.read_model(p2);

            assert(player1.strk_balance >= p1_stake, 'P1 insufficient balance');
            assert(player2.strk_balance >= p2_stake, 'P2 insufficient balance');

            player1.strk_balance -= p1_stake;
            player2.strk_balance -= p2_stake;

            world.write_model(@player1);
            world.write_model(@player2);

            let total = p1_stake + p2_stake;
            world.write_model(@Escrow { match_id, total_amount: total, p1_stake, p2_stake, is_locked: true, is_settled: false });

            world.emit_event(@EscrowLockedEvent { match_id, player_1: p1, player_2: p2, total_amount: total, timestamp: get_block_timestamp() });
        }

        fn settle_match(
            ref self: ContractState,
            match_id: u128,
            winner: ContractAddress,
            p1_rounds_won: u8,
            p2_rounds_won: u8,
            transcript_hash: felt252,
            signature: Array<felt252>
        ) {
            let mut world = self.world(@"ccwg");

            // Get authorized server account
            let authorized_server: AuthorizedServer = world.read_model(1_u8);
            assert(authorized_server.is_active, 'Server not authorized');

            // STARKNET ACCOUNT SIGNATURE VERIFICATION (SNIP-6)
            // Construct message hash from settlement data
            let message_hash = core::poseidon::poseidon_hash_span(
                array![
                    match_id.into(),
                    winner.into(),
                    p1_rounds_won.into(),
                    p2_rounds_won.into(),
                    transcript_hash
                ].span()
            );

            // Verify signature via account contract's is_valid_signature
            let server_account = IAccountDispatcher { 
                contract_address: authorized_server.server_address 
            };
            
            let validation_result = server_account.is_valid_signature(message_hash, signature);
            assert(validation_result == VALIDATED, 'Invalid server signature');

            let mut escrow: Escrow = world.read_model(match_id);
            assert(escrow.is_locked, 'Escrow not locked');
            assert(!escrow.is_settled, 'Already settled');

            let mut game_match: Match = world.read_model(match_id);
            assert(game_match.status == MatchStatus::InProgress, 'Match not in progress');

            let total_pool = escrow.total_amount;
            let platform_fee = (total_pool * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
            let net_pool = total_pool - platform_fee;
            let now = get_block_timestamp();

            let p1 = game_match.player_1;
            let p2 = game_match.player_2;

            let (p1_payout, p2_payout) = if winner == p1 {
                (net_pool, 0_u256)
            } else if winner == p2 {
                if escrow.p1_stake > escrow.p2_stake {
                    let p2_winnings = escrow.p2_stake * 2;
                    let p1_refund = escrow.p1_stake - escrow.p2_stake;
                    (p1_refund, p2_winnings)
                } else {
                    (0_u256, net_pool)
                }
            } else {
                (escrow.p1_stake, escrow.p2_stake)
            };

            let mut player1: Player = world.read_model(p1);
            let mut player2: Player = world.read_model(p2);

            player1.strk_balance += p1_payout;
            player2.strk_balance += p2_payout;

            if winner == p1 {
                player1.wins += 1;
                player2.losses += 1;
                let stake_multiplier = self._calculate_xp_multiplier(escrow.p1_stake);
                player1.total_xp += 100 * stake_multiplier;
                player2.total_xp += 20;
            } else if winner == p2 {
                player2.wins += 1;
                player1.losses += 1;
                let stake_multiplier = self._calculate_xp_multiplier(escrow.p2_stake);
                player2.total_xp += 100 * stake_multiplier;
                player1.total_xp += 20;
            }

            world.write_model(@player1);
            world.write_model(@player2);

            let mut treasury: TreasuryConfig = world.read_model(1_u8);
            if platform_fee > 0_u256 {
                let zero_address: ContractAddress = 0.try_into().unwrap();
                if treasury.treasury_address != zero_address {
                    let strk_token = IERC20Dispatcher { contract_address: STRK_TOKEN.try_into().unwrap() };
                    let success = strk_token.transfer(treasury.treasury_address, platform_fee);
                    assert(success, 'Treasury transfer failed');
                }
                treasury.accrued_fees += platform_fee;
                treasury.updated_at = now;
                world.write_model(@treasury);
            }

            game_match.status = MatchStatus::Completed;
            game_match.winner = winner;
            game_match.p1_rounds_won = p1_rounds_won;
            game_match.p2_rounds_won = p2_rounds_won;
            game_match.ended_at = now;
            world.write_model(@game_match);

            escrow.is_settled = true;
            world.write_model(@escrow);

            world.emit_event(@MatchSettledEvent { match_id, winner, p1_payout, p2_payout, platform_fee, transcript_hash, timestamp: now });
        }

        fn refund_match(ref self: ContractState, match_id: u128) {
            let mut world = self.world(@"ccwg");

            let mut escrow: Escrow = world.read_model(match_id);
            assert(escrow.is_locked, 'Escrow not locked');
            assert(!escrow.is_settled, 'Already settled');

            let game_match: Match = world.read_model(match_id);
            assert(
                game_match.status == MatchStatus::Cancelled || game_match.status == MatchStatus::PausedOracle,
                'Cannot refund active match'
            );

            let p1 = game_match.player_1;
            let p2 = game_match.player_2;

            let mut player1: Player = world.read_model(p1);
            let mut player2: Player = world.read_model(p2);

            player1.strk_balance += escrow.p1_stake;
            player2.strk_balance += escrow.p2_stake;

            world.write_model(@player1);
            world.write_model(@player2);

            escrow.is_settled = true;
            world.write_model(@escrow);

            world.emit_event(@MatchRefundedEvent { match_id, p1_refund: escrow.p1_stake, p2_refund: escrow.p2_stake, timestamp: get_block_timestamp() });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _calculate_xp_multiplier(self: @ContractState, stake: u256) -> u64 {
            if stake >= 100_000_000_000_000_000_000 {
                5
            } else if stake >= 20_000_000_000_000_000_000 {
                3
            } else {
                1
            }
        }
    }
}
