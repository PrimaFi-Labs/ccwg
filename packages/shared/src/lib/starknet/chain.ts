// Shared package: @ccwg/shared/lib/starknet/chain
// Extracted utilities used by both the Next.js app and the WS server.
// The full chain.ts (on-chain transaction builders) stays in ccwg-web.

const DEFAULT_RPC = 'https://api.cartridge.gg/x/starknet/sepolia';

/**
 * Strip surrounding quotes / trim / reject "undefined"/"null".
 */
export function normalizeEnv(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') return undefined;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted || undefined;
  }
  return trimmed;
}

export function getRpcUrl(): string {
  return (
    normalizeEnv(process.env.RPC_URL) ||
    normalizeEnv(process.env.NEXT_PUBLIC_RPC_URL) ||
    normalizeEnv(process.env.NEXT_PUBLIC_STARKNET_RPC_URL) ||
    normalizeEnv(process.env.STARKNET_RPC_URL) ||
    DEFAULT_RPC
  );
}
