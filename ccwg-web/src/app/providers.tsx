// ccwg-web/src/app/providers.tsx

'use client';

import { ReactNode } from 'react';
import { StarknetConfig, jsonRpcProvider, voyager } from '@starknet-react/core';
import { sepolia, mainnet } from '@starknet-react/chains';
import { controllerConnector } from '@/src/lib/cartridge/controller';
import { ThemeProvider } from '@/src/lib/theme/ThemeContext';

const provider = jsonRpcProvider({
  rpc: (_chain) => {
    const rpcUrl =
      process.env.NEXT_PUBLIC_CARTRIDGE_RPC ||
      'https://api.cartridge.gg/x/starknet/sepolia';
    return { nodeUrl: rpcUrl };
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <StarknetConfig
        autoConnect
        chains={[sepolia, mainnet]}
        provider={provider}
        connectors={[controllerConnector]}
        explorer={voyager}
      >
        {children}
      </StarknetConfig>
    </ThemeProvider>
  );
}