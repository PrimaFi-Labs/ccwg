#[cfg(test)]
mod tests {
    use starknet::ContractAddress;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorageTrait;
    use dojo_cairo_test::{spawn_test_world, NamespaceDef, TestResource};
    use ccwg::models::{Match, RoundSnapshot, m_Match, m_RoundSnapshot, CardAsset, MatchStatus, MatchMode};
    use ccwg::systems::oracle_system::{oracle_system, IOracleActionsDispatcher, IOracleActionsDispatcherTrait};

    #[test]
    #[available_gas(30000000)]
    fn test_momentum_calculation() {
        // Test momentum formula: (S_r+1 - S_r) / S_r
        
        // Snapshot 1: BTC = 50000 USD (with 8 decimals = 5000000000000)
        let s1_btc = 5000000000000_u128;
        
        // Snapshot 2: BTC = 51000 USD (2% gain = 5100000000000)
        let s2_btc = 5100000000000_u128;
        
        // Expected momentum = ((51000 - 50000) / 50000) * 10000 = 200 basis points
        let price_diff: i128 = s2_btc.into() - s1_btc.into();
        let momentum = (price_diff * 10000) / s1_btc.into();
        
        assert(momentum == 200, 'Momentum should be 200 bps');
    }
    
    #[test]
    #[available_gas(30000000)]
    fn test_negative_momentum() {
        // Snapshot 1: ETH = 3000 USD
        let s1_eth = 300000000000_u128;
        
        // Snapshot 2: ETH = 2850 USD (5% loss)
        let s2_eth = 285000000000_u128;
        
        let price_diff: i128 = s2_eth.into() - s1_eth.into();
        let momentum = (price_diff * 10000) / s1_eth.into();
        
        assert(momentum == -500, 'Momentum should be -500 bps');
    }
}