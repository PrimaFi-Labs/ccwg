//ccwg/contracts/src/systems/admin_system.cairo

use starknet::ContractAddress;

#[starknet::interface]
pub trait IAdminActions<T> {
    fn initialize_server(ref self: T, server_address: ContractAddress);
    fn deactivate_server(ref self: T);
    fn set_treasury(ref self: T, treasury_address: ContractAddress);
}

#[dojo::contract]
pub mod admin_system {
    use super::IAdminActions;
    use ccwg::models::{AuthorizedServer, TreasuryConfig};
    use dojo::model::ModelStorage;
    use starknet::{ContractAddress, get_block_timestamp};
    
    const DEFAULT_TREASURY_ADDRESS: felt252 =
        0x056359c2b521ebac42590279b63d10999a50df2fec3ca54f41e11933c3f16b0d;

    #[abi(embed_v0)]
    impl AdminActionsImpl of IAdminActions<ContractState> {
        fn initialize_server(ref self: ContractState, server_address: ContractAddress) {
            let mut world = self.world(@"ccwg");
            let now = get_block_timestamp();
            
            world.write_model(
                @AuthorizedServer {
                    server_id: 1_u8,
                    server_address: server_address,
                    is_active: true
                }
            );

            world.write_model(
                @TreasuryConfig {
                    config_id: 1_u8,
                    treasury_address: DEFAULT_TREASURY_ADDRESS.try_into().unwrap(),
                    accrued_fees: 0,
                    updated_at: now
                }
            );
        }

        fn deactivate_server(ref self: ContractState) {
            let mut world = self.world(@"ccwg");
            
            let mut server: AuthorizedServer = world.read_model(1_u8);
            server.is_active = false;
            world.write_model(@server);
        }

        fn set_treasury(ref self: ContractState, treasury_address: ContractAddress) {
            let mut world = self.world(@"ccwg");

            let mut config: TreasuryConfig = world.read_model(1_u8);
            config.treasury_address = treasury_address;
            config.updated_at = get_block_timestamp();
            world.write_model(@config);
        }
    }
}
