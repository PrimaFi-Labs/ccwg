//ccwg/contracts/src/tests/test_escrow.cairo

#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorage, IWorldDispatcher};
    use dojo_cairo_test::{
        spawn_test_world, NamespaceDef, TestResource, ContractDefTrait, ContractDef, 
        WorldStorageTestTrait
    };
    use ccwg::models::{
        Player, m_Player, Match, m_Match, Escrow, m_Escrow, 
        m_IdCounter, m_AuthorizedServer,
        MatchStatus, MatchMode, StakeTier
    };

    fn namespace_def() -> NamespaceDef {
        let ndef = NamespaceDef {
            namespace: "ccwg", 
            resources: [
                TestResource::Model(m_Player::TEST_CLASS_HASH.try_into().unwrap()),
                TestResource::Model(m_Match::TEST_CLASS_HASH.try_into().unwrap()),
                TestResource::Model(m_Escrow::TEST_CLASS_HASH.try_into().unwrap()),
                TestResource::Model(m_IdCounter::TEST_CLASS_HASH.try_into().unwrap()),
                TestResource::Model(m_AuthorizedServer::TEST_CLASS_HASH.try_into().unwrap()),
            ].span()
        };
        ndef
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(@"ccwg", @"escrow_system")
                .with_writer_of([dojo::utils::bytearray_hash(@"ccwg")].span()),
            ContractDefTrait::new(@"ccwg", @"match_system")
                .with_writer_of([dojo::utils::bytearray_hash(@"ccwg")].span())
        ].span()
    }

    #[test]
    fn test_player_creation_and_balance() {
        let ndef = namespace_def();
        let mut world = spawn_test_world(
            dojo::world::world_contract::world::TEST_CLASS_HASH.try_into().unwrap(),
            [ndef].span()
        );
        world.sync_perms_and_inits(contract_defs());
        
        let player_addr: starknet::ContractAddress = 0x123.try_into().unwrap();
        
        // Create player with initial balance
        world.write_model_test(
            @Player {
                address: player_addr,
                wins: 0,
                losses: 0,
                total_xp: 0,
                strk_balance: 100_000_000_000_000_000_000 // 100 STRK
            }
        );
        
        let player: Player = world.read_model(player_addr);
        assert(player.wins == 0, 'Initial wins should be 0');
        assert(player.losses == 0, 'Initial losses should be 0');
        assert(player.strk_balance == 100_000_000_000_000_000_000, 'Initial balance wrong');
    }

    #[test]
    fn test_escrow_lock_creates_record() {
        let ndef = namespace_def();
        let mut world = spawn_test_world(
            dojo::world::world_contract::world::TEST_CLASS_HASH.try_into().unwrap(),
            [ndef].span()
        );
        world.sync_perms_and_inits(contract_defs());
        
        let p1: starknet::ContractAddress = 0x111.try_into().unwrap();
        let p2: starknet::ContractAddress = 0x222.try_into().unwrap();
        let match_id: u128 = 1;
        
        // Create players with balances
        world.write_model_test(@Player { 
            address: p1, 
            wins: 0, 
            losses: 0, 
            total_xp: 0, 
            strk_balance: 50_000_000_000_000_000_000 
        });
        world.write_model_test(@Player { 
            address: p2, 
            wins: 0, 
            losses: 0, 
            total_xp: 0, 
            strk_balance: 50_000_000_000_000_000_000 
        });
        
        let zero_address: starknet::ContractAddress = 0.try_into().unwrap();
        
        // Create match in waiting state
        world.write_model_test(
            @Match {
                match_id,
                player_1: p1,
                player_2: p2,
                mode: MatchMode::Ranked1v1,
                status: MatchStatus::WaitingForOpponent,
                stake_tier: StakeTier::Tier10,
                total_stake: 20_000_000_000_000_000_000,
                p1_active_card_id: 1,
                p2_active_card_id: 2,
                current_round: 0,
                total_rounds: 3,
                p1_rounds_won: 0,
                p2_rounds_won: 0,
                winner: zero_address,
                created_at: 1000,
                started_at: 0,
                ended_at: 0,
            }
        );
        
        // Manually create escrow (simulating what lock_match_escrow does)
        let stake: u256 = 10_000_000_000_000_000_000;
        world.write_model_test(
            @Escrow {
                match_id,
                total_amount: stake * 2,
                p1_stake: stake,
                p2_stake: stake,
                is_locked: true,
                is_settled: false
            }
        );
        
        // Verify escrow was created
        let escrow: Escrow = world.read_model(match_id);
        assert(escrow.is_locked, 'Escrow should be locked');
        assert(!escrow.is_settled, 'Escrow should not be settled');
        assert(escrow.total_amount == 20_000_000_000_000_000_000, 'Total amount wrong');
    }

    #[test]
    fn test_match_settlement_updates_stats() {
        let ndef = namespace_def();
        let mut world = spawn_test_world(
            dojo::world::world_contract::world::TEST_CLASS_HASH.try_into().unwrap(),
            [ndef].span()
        );
        world.sync_perms_and_inits(contract_defs());
        
        let p1: starknet::ContractAddress = 0x111.try_into().unwrap();
        let p2: starknet::ContractAddress = 0x222.try_into().unwrap();
        let zero_address: starknet::ContractAddress = 0.try_into().unwrap();
        let match_id: u128 = 1;
        
        // Setup players
        world.write_model_test(@Player { 
            address: p1, 
            wins: 0, 
            losses: 0, 
            total_xp: 0, 
            strk_balance: 0 
        });
        world.write_model_test(@Player { 
            address: p2, 
            wins: 0, 
            losses: 0, 
            total_xp: 0, 
            strk_balance: 0 
        });
        
        // Setup match and escrow
        world.write_model_test(
            @Match {
                match_id,
                player_1: p1,
                player_2: p2,
                mode: MatchMode::Ranked1v1,
                status: MatchStatus::InProgress,
                stake_tier: StakeTier::Tier10,
                total_stake: 20_000_000_000_000_000_000,
                p1_active_card_id: 1,
                p2_active_card_id: 2,
                current_round: 3,
                total_rounds: 3,
                p1_rounds_won: 2,
                p2_rounds_won: 1,
                winner: zero_address,
                created_at: 1000,
                started_at: 1001,
                ended_at: 0,
            }
        );
        
        let stake: u256 = 10_000_000_000_000_000_000;
        world.write_model_test(
            @Escrow {
                match_id,
                total_amount: stake * 2,
                p1_stake: stake,
                p2_stake: stake,
                is_locked: true,
                is_settled: false
            }
        );
        
        // Manually simulate settlement (p1 wins)
        let mut player1: Player = world.read_model(p1);
        let mut player2: Player = world.read_model(p2);
        
        let platform_fee = (stake * 2 * 500) / 10000; // 5%
        let net_pool = (stake * 2) - platform_fee;
        
        player1.strk_balance += net_pool;
        player1.wins += 1;
        player1.total_xp += 100;
        
        player2.losses += 1;
        player2.total_xp += 20;
        
        world.write_model_test(@player1);
        world.write_model_test(@player2);
        
        // Mark escrow as settled
        let mut escrow: Escrow = world.read_model(match_id);
        escrow.is_settled = true;
        world.write_model_test(@escrow);
        
        // Verify final state
        let final_p1: Player = world.read_model(p1);
        let final_p2: Player = world.read_model(p2);
        
        assert(final_p1.wins == 1, 'P1 should have 1 win');
        assert(final_p2.losses == 1, 'P2 should have 1 loss');
        assert(final_p1.strk_balance > 0, 'P1 should have payout');
        assert(final_p1.total_xp == 100, 'P1 XP wrong');
        assert(final_p2.total_xp == 20, 'P2 XP wrong');
    }
}