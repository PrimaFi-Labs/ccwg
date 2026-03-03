// ccwg-web/src/lib/cartridge/controller.ts
// UPDATED - Added STRK transfer policy for marketplace purchases

import { ControllerConnector } from '@cartridge/connector';
import { constants } from 'starknet';
import {
  MATCH_SYSTEM_ADDRESS,
  ESCROW_SYSTEM_ADDRESS,
  EVENT_SYSTEM_ADDRESS,
  ROOM_SYSTEM_ADDRESS,
  MARKET_SYSTEM_ADDRESS,
} from '@/src/types/contracts';
import { getNetworkConfig } from './network';

const VRF_PROVIDER_ADDRESS =
  '0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f';

const STRK_TOKEN_ADDRESS =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

const net = getNetworkConfig();

console.log('[ControllerConnector] network:', net.network, 'chainId:', net.chainId);

const contractPolicies: Record<string, { methods: Array<{ entrypoint: string }> }> = {
  [STRK_TOKEN_ADDRESS]: {
    methods: [
      { entrypoint: 'transfer' },
      { entrypoint: 'approve' },
      { entrypoint: 'balanceOf' },
    ],
  },
  [VRF_PROVIDER_ADDRESS]: {
    methods: [
      { entrypoint: 'request_random' },
    ],
  },
  [MATCH_SYSTEM_ADDRESS]: {
    methods: [
      { entrypoint: 'create_ranked_match' },
      { entrypoint: 'create_ai_match' },
      { entrypoint: 'cancel_match' },
    ],
  },
  [ESCROW_SYSTEM_ADDRESS]: {
    methods: [
      { entrypoint: 'deposit_stake' },
      { entrypoint: 'withdraw_balance' },
      { entrypoint: 'lock_match_escrow' },
    ],
  },
  [EVENT_SYSTEM_ADDRESS]: {
    methods: [
      { entrypoint: 'join_event' },
      { entrypoint: 'create_event' },
      { entrypoint: 'start_event' },
      { entrypoint: 'cancel_event' },
    ],
  },
};

if (ROOM_SYSTEM_ADDRESS !== '0x0') {
  contractPolicies[ROOM_SYSTEM_ADDRESS] = {
    methods: [
      { entrypoint: 'create_room' },
      { entrypoint: 'join_room' },
      { entrypoint: 'leave_room' },
      { entrypoint: 'start_room' },
      { entrypoint: 'settle_room' },
      { entrypoint: 'cancel_room' },
    ],
  };
}

if (MARKET_SYSTEM_ADDRESS !== '0x0') {
  contractPolicies[MARKET_SYSTEM_ADDRESS] = {
    methods: [
      { entrypoint: 'buy_item' },
    ],
  };
}

const policies = {
  contracts: contractPolicies,
};

export const isPaymasterEnabled = (): boolean => {
  return process.env.NEXT_PUBLIC_PAYMASTER_ENABLED === 'true';
};

export const controllerConnector = new ControllerConnector({
  chains: [{ rpcUrl: net.rpcUrl }],
  defaultChainId: net.chainId,
  policies,
  // Surface session errors so our retry/fallback logic in useAuthSession can
  // inspect them. Previously false caused keychain timeouts to be silently
  // swallowed, making the "timeout waiting for keychain" surface as a vague
  // connection failure with no retry path.
  propagateSessionErrors: true,
  signupOptions: ['webauthn', 'google', 'discord', 'password'],
  url: 'https://x.cartridge.gg',
});

console.log('[ControllerConnector] Initialized with', Object.keys(policies.contracts).length, 'contracts', isPaymasterEnabled() ? '(paymaster enabled)' : '(no paymaster)');

export const openCartridgeKeychain = (redirectUrl: string) => {
  const open = (controllerConnector as any)?.controller?.open;
  if (typeof open === 'function') {
    open({ redirectUrl });
  }
};
