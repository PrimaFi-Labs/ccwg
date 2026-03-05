//ccwg/contracts/src/systems/oracle_system.cairo

#[starknet::interface]
pub trait IOracleActions<T> {
    fn capture_round_snapshot(ref self: T, match_id: u128, round_number: u8) -> bool;
    fn get_price_for_asset(self: @T, asset: ccwg::models::CardAsset) -> PriceResponse;
    fn check_oracle_health(self: @T, asset: ccwg::models::CardAsset) -> (bool, u64);
}

// Simplified response structure for public API
#[derive(Drop, Copy, Serde)]
pub struct PriceResponse {
    pub price: u128,
    pub decimals: u32,
    pub last_updated_timestamp: u64,
}

// Full Pragma response (internal use)
#[derive(Drop, Copy, Serde)]
struct PragmaPricesResponse {
    price: u128,
    decimals: u32,
    last_updated_timestamp: u64,
    num_sources_aggregated: u32,
    expiration_timestamp: Option<u64>,
}

#[derive(Drop, Copy, Serde)]
enum DataType {
    SpotEntry: felt252,
    FutureEntry: (felt252, u64),
    GenericEntry: felt252,
}

#[derive(Drop, Copy, Serde)]
enum AggregationMode {
    Median: (),
    Mean: (),
    Error: (),
}

#[starknet::interface]
trait IPragmaABI<TContractState> {
    fn get_data(
        self: @TContractState, 
        data_type: DataType, 
        aggregation_mode: AggregationMode
    ) -> PragmaPricesResponse;
}

#[dojo::contract]
pub mod oracle_system {
    use super::{IOracleActions, PriceResponse, PragmaPricesResponse, DataType, AggregationMode, IPragmaABIDispatcher, IPragmaABIDispatcherTrait};
    use ccwg::models::{Match, RoundSnapshot, CardAsset, CardAssetIntoPairId, MatchStatus};
    use dojo::model::ModelStorage;
    use dojo::event::EventStorage;

    //=============================================================================================================================================
    //const USE_MOCK_ORACLE: bool = false; set to false when Pragma is live and reliable, true for testing and fallback || Sepolia oracle is stale.
    //=============================================================================================================================================

    const USE_MOCK_ORACLE: bool = true;
    
    const PRAGMA_ORACLE_ADDRESS: felt252 = 0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a;
    const MAX_STALENESS_PAID: u64 = 120;
    const MAX_STALENESS_FREE: u64 = 180;

    const MOCK_BTC_BASE: u128 = 6707247000000;
    const MOCK_ETH_BASE: u128 = 194185000000;
    const MOCK_STRK_BASE: u128 = 4999000;
    const MOCK_SOL_BASE: u128 = 8257000000;
    const MOCK_DOGE_BASE: u128 = 9415000;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct SnapshotCapturedEvent {
        #[key]
        pub match_id: u128,
        #[key]
        pub round_number: u8,
        pub btc_price: u128,
        pub eth_price: u128,
        pub strk_price: u128,
        pub sol_price: u128,
        pub doge_price: u128,
        pub snapshot_timestamp: u64,
        pub oracle_staleness: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct OracleStaleEvent {
        #[key]
        pub match_id: u128,
        #[key]
        pub round_number: u8,
        pub asset: CardAsset,
        pub staleness: u64,
        pub max_allowed: u64,
    }

    #[abi(embed_v0)]
    impl OracleActionsImpl of IOracleActions<ContractState> {
        
        fn capture_round_snapshot(
            ref self: ContractState,
            match_id: u128,
            round_number: u8
        ) -> bool {
            let mut world = self.world(@"ccwg");
            let now = starknet::get_block_timestamp();
            
            let game_match: Match = world.read_model(match_id);
            assert(game_match.status == MatchStatus::InProgress, 'Match not in progress');
            
            if USE_MOCK_ORACLE {
                let btc_response = self._get_mock_price_response(CardAsset::BTC, match_id, round_number);
                let eth_response = self._get_mock_price_response(CardAsset::ETH, match_id, round_number);
                let strk_response = self._get_mock_price_response(CardAsset::STRK, match_id, round_number);
                let sol_response = self._get_mock_price_response(CardAsset::SOL, match_id, round_number);
                let doge_response = self._get_mock_price_response(CardAsset::DOGE, match_id, round_number);
                
                world.write_model(
                    @RoundSnapshot {
                        match_id,
                        round_number,
                        btc_price: btc_response.price,
                        eth_price: eth_response.price,
                        strk_price: strk_response.price,
                        sol_price: sol_response.price,
                        doge_price: doge_response.price,
                        snapshot_timestamp: now,
                        oracle_staleness: 0
                    }
                );
                
                world.emit_event(
                    @SnapshotCapturedEvent {
                        match_id,
                        round_number,
                        btc_price: btc_response.price,
                        eth_price: eth_response.price,
                        strk_price: strk_response.price,
                        sol_price: sol_response.price,
                        doge_price: doge_response.price,
                        snapshot_timestamp: now,
                        oracle_staleness: 0
                    }
                );
                
                return true;
            } else {
                let pragma = IPragmaABIDispatcher {
                    contract_address: PRAGMA_ORACLE_ADDRESS.try_into().unwrap()
                };
                
                let max_staleness = if game_match.mode == ccwg::models::MatchMode::VsAI {
                    MAX_STALENESS_FREE
                } else {
                    MAX_STALENESS_PAID
                };
                
                let btc_response = self._fetch_price_safe(@pragma, CardAsset::BTC);
                let eth_response = self._fetch_price_safe(@pragma, CardAsset::ETH);
                let strk_response = self._fetch_price_safe(@pragma, CardAsset::STRK);
                let sol_response = self._fetch_price_safe(@pragma, CardAsset::SOL);
                let doge_response = self._fetch_price_safe(@pragma, CardAsset::DOGE);
                
                let btc_staleness: u64 = now - btc_response.last_updated_timestamp;
                let eth_staleness: u64 = now - eth_response.last_updated_timestamp;
                
                let max_current_staleness = if btc_staleness > eth_staleness {
                    btc_staleness
                } else {
                    eth_staleness
                };
                
                if max_current_staleness > max_staleness {
                    if round_number > 1 {
                        let prev_snapshot: RoundSnapshot = world.read_model((match_id, round_number - 1));
                        
                        if prev_snapshot.oracle_staleness > max_staleness {
                            let mut paused_match = game_match;
                            paused_match.status = MatchStatus::PausedOracle;
                            world.write_model(@paused_match);
                            
                            world.emit_event(
                                @OracleStaleEvent {
                                    match_id,
                                    round_number,
                                    asset: CardAsset::BTC,
                                    staleness: max_current_staleness,
                                    max_allowed: max_staleness
                                }
                            );
                            
                            return false;
                        }
                    }
                    
                    if round_number > 1 {
                        let prev_snapshot: RoundSnapshot = world.read_model((match_id, round_number - 1));
                        
                        world.write_model(
                            @RoundSnapshot {
                                match_id,
                                round_number,
                                btc_price: prev_snapshot.btc_price,
                                eth_price: prev_snapshot.eth_price,
                                strk_price: prev_snapshot.strk_price,
                                sol_price: prev_snapshot.sol_price,
                                doge_price: prev_snapshot.doge_price,
                                snapshot_timestamp: now,
                                oracle_staleness: max_current_staleness
                            }
                        );
                        
                        return true;
                    }
                }
                
                world.write_model(
                    @RoundSnapshot {
                        match_id,
                        round_number,
                        btc_price: btc_response.price,
                        eth_price: eth_response.price,
                        strk_price: strk_response.price,
                        sol_price: sol_response.price,
                        doge_price: doge_response.price,
                        snapshot_timestamp: now,
                        oracle_staleness: max_current_staleness
                    }
                );
                
                world.emit_event(
                    @SnapshotCapturedEvent {
                        match_id,
                        round_number,
                        btc_price: btc_response.price,
                        eth_price: eth_response.price,
                        strk_price: strk_response.price,
                        sol_price: sol_response.price,
                        doge_price: doge_response.price,
                        snapshot_timestamp: now,
                        oracle_staleness: max_current_staleness
                    }
                );
                
                return true;
            }
        }
        
        fn get_price_for_asset(self: @ContractState, asset: CardAsset) -> PriceResponse {
            if USE_MOCK_ORACLE {
                self._get_mock_price_response(asset, 0, 0)
            } else {
                let pragma = IPragmaABIDispatcher {
                    contract_address: PRAGMA_ORACLE_ADDRESS.try_into().unwrap()
                };
                
                let response = self._fetch_price_safe(@pragma, asset);
                
                // Convert Pragma response to our PriceResponse
                PriceResponse {
                    price: response.price,
                    decimals: response.decimals,
                    last_updated_timestamp: response.last_updated_timestamp,
                }
            }
        }
        
        fn check_oracle_health(self: @ContractState, asset: CardAsset) -> (bool, u64) {
            if USE_MOCK_ORACLE {
                (true, 0)
            } else {
                let pragma = IPragmaABIDispatcher {
                    contract_address: PRAGMA_ORACLE_ADDRESS.try_into().unwrap()
                };
                
                let response = self._fetch_price_safe(@pragma, asset);
                let now = starknet::get_block_timestamp();
                let staleness: u64 = now - response.last_updated_timestamp;
                
                let is_healthy = staleness <= MAX_STALENESS_PAID;
                (is_healthy, staleness)
            }
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _fetch_price_safe(
            self: @ContractState,
            pragma: @IPragmaABIDispatcher,
            asset: CardAsset
        ) -> PragmaPricesResponse {
            let pair_id: felt252 = asset.into();
            
            let response = pragma.get_data(
                DataType::SpotEntry(pair_id),
                AggregationMode::Median(())
            );
            
            response
        }

        fn _get_mock_price_response(
            self: @ContractState,
            asset: CardAsset,
            match_id: u128,
            round_number: u8
        ) -> PriceResponse {
            let price = self._get_mock_price(asset, match_id, round_number);
            let timestamp = starknet::get_block_timestamp();
            
            PriceResponse {
                price: price,
                decimals: 8,  // All crypto prices use 8 decimals
                last_updated_timestamp: timestamp,
            }
        }

        fn _get_mock_price(
            self: @ContractState,
            asset: CardAsset,
            match_id: u128,
            round_number: u8
        ) -> u128 {
            let base_price = match asset {
                CardAsset::BTC => MOCK_BTC_BASE,
                CardAsset::ETH => MOCK_ETH_BASE,
                CardAsset::STRK => MOCK_STRK_BASE,
                CardAsset::SOL => MOCK_SOL_BASE,
                CardAsset::DOGE => MOCK_DOGE_BASE,
            };
            
            let timestamp = starknet::get_block_timestamp();
            
            let seed1 = (match_id.into() * 7919_u256 
                        + round_number.into() * 2663_u256 
                        + timestamp.into() * 10007_u256) % 100000_u256;
            
            let seed2 = (match_id.into() * 3571_u256 
                        + round_number.into() * 9973_u256 
                        + timestamp.into() * 4999_u256) % 10000_u256;
            
            let volatility_seed = (match_id.into() * 1009_u256 
                                  + timestamp.into() * 6421_u256) % 100_u256;
            
            let is_volatile = volatility_seed >= 70_u256;
            let volatility_multiplier = if is_volatile {
                150_u256 + (volatility_seed % 150_u256)
            } else {
                100_u256
            };
            
            let max_variation_bp = match asset {
                CardAsset::BTC => 200_u256,
                CardAsset::ETH => 300_u256,
                CardAsset::STRK => 800_u256,
                CardAsset::SOL => 400_u256,
                CardAsset::DOGE => 1200_u256,
            };
            
            let raw_variation = seed1 % (max_variation_bp * 2_u256);
            let adjusted_raw = (raw_variation * volatility_multiplier) / 100_u256;
            let micro = seed2 % 20_u256;
            let total_raw = adjusted_raw + micro;
            
            let is_positive = (seed1 + seed2) % 2_u256 == 0_u256;
            
            let base_u256: u256 = base_price.into();
            
            let adjusted = if is_positive {
                (base_u256 * (10000_u256 + total_raw)) / 10000_u256
            } else {
                if total_raw < 10000_u256 {
                    (base_u256 * (10000_u256 - total_raw)) / 10000_u256
                } else {
                    base_u256 / 100_u256
                }
            };
            
            adjusted.try_into().unwrap()
        }
    }
}