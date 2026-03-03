// ccwg-web/src/lib/rpc/provider.ts

import 'server-only';
import { RpcProvider } from 'starknet';

class RPCProviderPool {
  private providers: RpcProvider[] = [];
  private currentIndex = 0;
  private readonly poolSize: number;
  private readonly rpcUrl: string;

  constructor(rpcUrl: string, poolSize: number = 3) {
    this.rpcUrl = rpcUrl;
    this.poolSize = poolSize;
    this.initializePool();
  }

  private initializePool() {
    for (let i = 0; i < this.poolSize; i++) {
      this.providers.push(
        new RpcProvider({
          nodeUrl: this.rpcUrl,
          retries: 2,
          // ✅ Avoid "Block identifier unmanaged: pending" on some RPCs
          // Let StarknetJS default, and pass block_id explicitly where needed.
          blockIdentifier: 'latest',
        })
      );
    }
  }

  getProvider(): RpcProvider {
    const provider = this.providers[this.currentIndex];
    const idx = this.currentIndex;
    this.currentIndex = (this.currentIndex + 1) % this.poolSize;

    console.log('[RPC Provider Pool] Using provider index:', idx, 'url:', this.rpcUrl);
    return provider;
  }

  async withRetry<T>(
    fn: (provider: RpcProvider) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const provider = this.getProvider();
        return await fn(provider);
      } catch (error) {
        lastError = error as Error;
        console.warn(`[RPC] Attempt ${attempt + 1}/${maxRetries} failed:`, error);

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt), 5000))
          );
        }
      }
    }

    throw lastError || new Error('RPC request failed');
  }
}

let providerPool: RPCProviderPool | null = null;

export const getRPCProviderPool = (): RPCProviderPool => {
  if (!providerPool) {
    const rpcUrl =
      process.env.NEXT_PUBLIC_CARTRIDGE_RPC ||
      process.env.NEXT_PUBLIC_CARTRIDGE_RPC_URL ||
      'https://api.cartridge.gg/x/starknet/sepolia';

    console.log('[RPC Provider Pool] Initializing with URL:', rpcUrl);
    providerPool = new RPCProviderPool(rpcUrl, 3);
  }
  return providerPool;
};

export const resetRPCProviderPool = () => {
  providerPool = null;
};
