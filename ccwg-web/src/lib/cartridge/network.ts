// ccwg-web/src/lib/cartridge/network.ts

import { constants } from 'starknet';

export const getNetworkConfig = () => {
  const network = process.env.NEXT_PUBLIC_NETWORK || 'sepolia';
  const chainId =
    network === 'sepolia'
      ? constants.StarknetChainId.SN_SEPOLIA
      : constants.StarknetChainId.SN_SEPOLIA;

  return {
    network,
    chainId,
    rpcUrl:
      process.env.NEXT_PUBLIC_CARTRIDGE_RPC ||
      'https://api.cartridge.gg/x/starknet/sepolia',
  };
};
