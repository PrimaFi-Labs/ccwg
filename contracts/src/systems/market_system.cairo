// ccwg/contracts/src/systems/market_system.cairo

use ccwg::models::MarketItemType;
use starknet::ContractAddress;

#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256
    ) -> bool;

    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
}

#[starknet::interface]
pub trait IMarketActions<T> {
    fn upsert_market_item(
        ref self: T,
        item_id: u128,
        name: felt252,
        item_type: MarketItemType,
        price_strk: u256,
        cards_granted: u8,
        per_wallet_limit: u16,
        is_active: bool
    );
    fn set_market_item_status(ref self: T, item_id: u128, is_active: bool);
    fn upsert_item_card_config(
        ref self: T,
        item_id: u128,
        index: u16,
        template_id: u128,
        guaranteed: bool,
        weight: u16
    );
    fn buy_item(ref self: T, item_id: u128) -> u128;
}

#[dojo::contract]
pub mod market_system {
    use super::{
        IMarketActions,
        IERC20Dispatcher,
        IERC20DispatcherTrait
    };

    use ccwg::models::{
        AuthorizedServer,
        IdCounter,
        MarketInventory,
        MarketItem,
        MarketItemCardConfig,
        MarketItemType,
        MarketPurchase,
        TreasuryConfig
    };
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};

    const STRK_TOKEN: felt252 =
        0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d;

    fn assert_authorized_server(world: @dojo::world::storage::WorldStorage) {
        let server: AuthorizedServer = world.read_model(1_u8);
        assert(server.is_active, 'Server not authorized');
        assert(get_caller_address() == server.server_address, 'Only authorized server');
    }

    fn next_purchase_id(ref world: dojo::world::storage::WorldStorage) -> u128 {
        let mut counter: IdCounter = world.read_model('market_purchase');
        if counter.id == 0 {
            counter.id = 'market_purchase';
            counter.value = 0;
        }
        counter.value += 1;
        let id = counter.value;
        world.write_model(@counter);
        id
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct MarketItemUpsertedEvent {
        #[key]
        pub item_id: u128,
        pub name: felt252,
        pub item_type: MarketItemType,
        pub price_strk: u256,
        pub cards_granted: u8,
        pub per_wallet_limit: u16,
        pub is_active: bool,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct MarketItemStatusEvent {
        #[key]
        pub item_id: u128,
        pub is_active: bool,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct MarketCardConfigEvent {
        #[key]
        pub item_id: u128,
        #[key]
        pub index: u16,
        pub template_id: u128,
        pub guaranteed: bool,
        pub weight: u16,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct ItemPurchasedEvent {
        #[key]
        pub item_id: u128,
        #[key]
        pub buyer: ContractAddress,
        pub purchase_id: u128,
        pub amount_paid: u256,
        pub quantity: u64,
        pub purchased_at: u64,
    }

    #[abi(embed_v0)]
    impl MarketActionsImpl of IMarketActions<ContractState> {
        fn upsert_market_item(
            ref self: ContractState,
            item_id: u128,
            name: felt252,
            item_type: MarketItemType,
            price_strk: u256,
            cards_granted: u8,
            per_wallet_limit: u16,
            is_active: bool
        ) {
            let mut world = self.world(@"ccwg");
            assert_authorized_server(@world);

            assert(item_id > 0, 'Invalid item id');
            assert(cards_granted > 0, 'Cards granted must be > 0');
            assert(cards_granted <= 20, 'Cards granted too high');

            let mut item: MarketItem = world.read_model(item_id);
            let now = get_block_timestamp();
            let created_at = if item.item_id == 0_u128 { now } else { item.created_at };

            item.item_id = item_id;
            item.name = name;
            item.item_type = item_type;
            item.price_strk = price_strk;
            item.cards_granted = cards_granted;
            item.per_wallet_limit = per_wallet_limit;
            item.is_active = is_active;
            item.created_at = created_at;
            item.updated_at = now;

            world.write_model(@item);

            world.emit_event(
                @MarketItemUpsertedEvent {
                    item_id,
                    name,
                    item_type,
                    price_strk,
                    cards_granted,
                    per_wallet_limit,
                    is_active
                }
            );
        }

        fn set_market_item_status(ref self: ContractState, item_id: u128, is_active: bool) {
            let mut world = self.world(@"ccwg");
            assert_authorized_server(@world);

            let mut item: MarketItem = world.read_model(item_id);
            assert(item.item_id != 0_u128, 'Item not found');

            item.is_active = is_active;
            item.updated_at = get_block_timestamp();
            world.write_model(@item);

            world.emit_event(@MarketItemStatusEvent { item_id, is_active });
        }

        fn upsert_item_card_config(
            ref self: ContractState,
            item_id: u128,
            index: u16,
            template_id: u128,
            guaranteed: bool,
            weight: u16
        ) {
            let mut world = self.world(@"ccwg");
            assert_authorized_server(@world);

            let item: MarketItem = world.read_model(item_id);
            assert(item.item_id != 0_u128, 'Item not found');

            world.write_model(
                @MarketItemCardConfig {
                    item_id,
                    index,
                    template_id,
                    guaranteed,
                    weight
                }
            );

            world.emit_event(
                @MarketCardConfigEvent {
                    item_id,
                    index,
                    template_id,
                    guaranteed,
                    weight
                }
            );
        }

        fn buy_item(ref self: ContractState, item_id: u128) -> u128 {
            let mut world = self.world(@"ccwg");
            let buyer = get_caller_address();

            let item: MarketItem = world.read_model(item_id);
            assert(item.item_id != 0_u128, 'Item not found');
            assert(item.is_active, 'Item inactive');

            let now = get_block_timestamp();

            let mut inventory: MarketInventory = world.read_model((buyer, item_id));
            let zero_address: ContractAddress = 0.try_into().unwrap();
            if inventory.player == zero_address {
                inventory.player = buyer;
                inventory.item_id = item_id;
                inventory.quantity = 0;
            }

            if item.per_wallet_limit > 0 {
                assert(inventory.quantity < item.per_wallet_limit.into(), 'Wallet limit reached');
            }

            if item.price_strk > 0_u256 {
                let this_contract = get_contract_address();

                // ✅ MUST be mutable because interface methods take `ref self`
                let mut strk_token = IERC20Dispatcher {
                    contract_address: STRK_TOKEN.try_into().unwrap()
                };

                let paid = strk_token.transfer_from(buyer, this_contract, item.price_strk);
                assert(paid, 'STRK transfer failed');

                let mut treasury: TreasuryConfig = world.read_model(1_u8);
                let zero_address: ContractAddress = 0.try_into().unwrap();
                if treasury.treasury_address != zero_address {
                    let sent = strk_token.transfer(treasury.treasury_address, item.price_strk);
                    assert(sent, 'Treasury transfer failed');
                }

                treasury.accrued_fees += item.price_strk;
                treasury.updated_at = now;
                world.write_model(@treasury);
            }

            inventory.quantity += 1;
            inventory.updated_at = now;
            world.write_model(@inventory);

            let purchase_id = next_purchase_id(ref world);

            world.write_model(
                @MarketPurchase {
                    purchase_id,
                    item_id,
                    buyer,
                    amount_paid: item.price_strk,
                    purchased_at: now
                }
            );

            world.emit_event(
                @ItemPurchasedEvent {
                    item_id,
                    buyer,
                    purchase_id,
                    amount_paid: item.price_strk,
                    quantity: inventory.quantity,
                    purchased_at: now
                }
            );

            purchase_id
        }
    }
}