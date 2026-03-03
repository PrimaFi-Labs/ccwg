// Contract ABIs and types
//ccwg/ccwg-web/src/types/contracts.ts
export const WORLD_ADDRESS = process.env.NEXT_PUBLIC_WORLD_ADDRESS as `0x${string}` || '0x07f3647c6cb682cdf2cc02f6348d24a8929f5f4c5d9c56159a80425c42fe9004';
export const MATCH_SYSTEM_ADDRESS = process.env.NEXT_PUBLIC_MATCH_SYSTEM_ADDRESS as `0x${string}` || '0x01e4593029bff8ed22cae9c1aede5daef4f74b0acfc8b01c85796359ed7600ea';
export const ESCROW_SYSTEM_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_SYSTEM_ADDRESS as `0x${string}` || '0x038b42fdfb42a25de102d628e271b57e24594e48eb4e9ddfa3c0d25aeb3f7b9a';
export const EVENT_SYSTEM_ADDRESS = process.env.NEXT_PUBLIC_EVENT_SYSTEM_ADDRESS as `0x${string}` || '0x05b238e4ca47e7e61cd5738a1011da8ea45854d176d08c9ba185fc0be38373f5';
export const ORACLE_SYSTEM_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_SYSTEM_ADDRESS as `0x${string}` || process.env.ORACLE_SYSTEM_ADDRESS as `0x${string}` || '0x048e4128aeafe0a088d2525e2e2ff8e4123ab82dc2b8962c7b296fde30a07990'; // Fallback for server
export const ROOM_SYSTEM_ADDRESS = process.env.NEXT_PUBLIC_ROOM_SYSTEM_ADDRESS as `0x${string}` || process.env.ROOM_SYSTEM_ADDRESS as `0x${string}` || '0x0783dd01c2d76d3275545952709686d41d6e265bac68d8a2f0125719b0a58f3d';
export const MARKET_SYSTEM_ADDRESS = process.env.NEXT_PUBLIC_MARKET_SYSTEM_ADDRESS as `0x${string}` || process.env.MARKET_SYSTEM_ADDRESS as `0x${string}` || '0x057d099649750b0a5e2883518a672653f52af4da8a6bc4d95a3109a641d90e38';

export const STRK_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_STRK_TOKEN ||
  process.env.NEXT_PUBLIC_STRK_TOKEN_ADDRESS ||
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'; // Sepolia STRK

// Contract call types
export interface CreateRankedMatchParams {
  opponent: string;
  deck: [number, number, number];
  stake_tier: number; // 0 = Tier10, 1 = Tier20, 2 = Tier100
  total_rounds: number;
}

export interface DepositStakeParams {
  amount: string; // Wei string
}

export interface SettleMatchParams {
  match_id: number;
  winner: string;
  p1_rounds_won: number;
  p2_rounds_won: number;
  transcript_hash: string;
  signature: string[];
}
