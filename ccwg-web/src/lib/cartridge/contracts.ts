// ccwg-web/src/lib/cartridge/contracts.ts

import { Account, Contract, CallData, RpcProvider, CairoCustomEnum } from 'starknet';
import {
  MATCH_SYSTEM_ADDRESS,
  ESCROW_SYSTEM_ADDRESS,
  EVENT_SYSTEM_ADDRESS,
  ORACLE_SYSTEM_ADDRESS,
} from '@/src/types/contracts';
import { getNetworkConfig } from './network';
import ORACLE_ABI from '@/src/abis/oracle_system.abi.json';

type CardAsset = 'BTC' | 'ETH' | 'STRK' | 'SOL' | 'DOGE';

const CARD_ASSETS: CardAsset[] = ['BTC', 'ETH', 'STRK', 'SOL', 'DOGE'];

const getProvider = () => {
  const { rpcUrl } = getNetworkConfig();
  return new RpcProvider({ nodeUrl: rpcUrl });
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function toBigIntSafe(v: unknown, fallback: bigint = 0n): bigint {
  try {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'number') return BigInt(Math.trunc(v));
    if (typeof v === 'string' && v.length > 0) return BigInt(v);
  } catch {
    // ignore
  }
  return fallback;
}

function toNumberSafe(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function assetFromIndex(asset: number): CardAsset {
  switch (asset) {
    case 0: return 'BTC';
    case 1: return 'ETH';
    case 2: return 'STRK';
    case 3: return 'SOL';
    case 4: return 'DOGE';
    default:
      throw new Error(`Invalid asset index: ${asset}`);
  }
}

/**
 * ✅ starknet.js v9: custom Cairo enums must be CairoCustomEnum instances.
 * Accepts several input shapes for convenience.
 */
function toCardAssetEnum(asset: unknown): CairoCustomEnum {
  // already a CairoCustomEnum
  if (asset instanceof CairoCustomEnum) return asset;

  // asset index -> variant
  if (typeof asset === 'number') {
    const v = assetFromIndex(asset);
    return new CairoCustomEnum({ [v]: {} });
  }

  // variant name
  if (typeof asset === 'string') {
    if (!CARD_ASSETS.includes(asset as CardAsset)) {
      throw new Error(`Invalid asset name: ${asset}`);
    }
    return new CairoCustomEnum({ [asset]: {} });
  }

  // raw object like { BTC: {} }
  if (isObject(asset)) {
    const keys = Object.keys(asset);
    if (keys.length === 1) {
      const k = keys[0];
      if (!CARD_ASSETS.includes(k as CardAsset)) {
        throw new Error(`Invalid asset enum key: ${k}`);
      }
      const payload = (asset as any)[k] ?? {};
      return new CairoCustomEnum({ [k]: payload });
    }
  }

  throw new Error(`Invalid asset enum value: ${String(asset)}`);
}

/**
 * Parses Cairo bool (can arrive as boolean, 0/1, or enum-like).
 */
function parseCoreBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'bigint') return v !== 0n;
  if (typeof v === 'string') return v !== '0' && v.toLowerCase() !== 'false';

  // CairoCustomEnum(core::bool) support
  if (v && typeof v === 'object') {
    const anyV = v as any;

    if (anyV instanceof CairoCustomEnum && typeof anyV.activeVariant === 'function') {
      return anyV.activeVariant() === 'True';
    }

    if (typeof anyV.activeVariant === 'function') {
      return anyV.activeVariant() === 'True';
    }

    if ('True' in anyV) return true;
    if ('False' in anyV) return false;
  }

  return false;
}

// Match System Contract
export class MatchSystemContract {
  private contract: Contract;

  constructor(account: Account) {
    this.contract = new Contract({
      abi: [],
      address: MATCH_SYSTEM_ADDRESS,
      providerOrAccount: account,
      parseRequest: false,
      parseResponse: false,
    });
  }

  async createRankedMatch(
    opponent: string,
    deck: [bigint, bigint, bigint],
    stakeTier: number,
    totalRounds: number
  ) {
    const calldata = CallData.compile({
      opponent,
      deck: { card_1: deck[0], card_2: deck[1], card_3: deck[2] },
      stake_tier: stakeTier,
      total_rounds: totalRounds,
    });

    return await this.contract.invoke('create_ranked_match', calldata);
  }

  async createAIMatch(deck: [bigint, bigint, bigint], totalRounds: number) {
    const calldata = CallData.compile({
      deck: { card_1: deck[0], card_2: deck[1], card_3: deck[2] },
      total_rounds: totalRounds,
    });

    return await this.contract.invoke('create_ai_match', calldata);
  }

  async cancelMatch(matchId: bigint) {
    return await this.contract.invoke('cancel_match', [matchId]);
  }
}

// Escrow System Contract
export class EscrowSystemContract {
  private contract: Contract;

  constructor(account: Account) {
    this.contract = new Contract({
      abi: [],
      address: ESCROW_SYSTEM_ADDRESS,
      providerOrAccount: account,
      parseRequest: false,
      parseResponse: false,
    });
  }

  async depositStake(amount: bigint) {
    return await this.contract.invoke('deposit_stake', [amount]);
  }

  async withdrawBalance(amount: bigint) {
    return await this.contract.invoke('withdraw_balance', [amount]);
  }

  async lockMatchEscrow(matchId: bigint, p1Stake: bigint, p2Stake: bigint) {
    return await this.contract.invoke('lock_match_escrow', [matchId, p1Stake, p2Stake]);
  }

  async settleMatch(
    matchId: bigint,
    winner: string,
    p1RoundsWon: number,
    p2RoundsWon: number,
    transcriptHash: string,
    signature: string[]
  ) {
    const calldata = CallData.compile({
      match_id: matchId,
      winner,
      p1_rounds_won: p1RoundsWon,
      p2_rounds_won: p2RoundsWon,
      transcript_hash: transcriptHash,
      signature,
    });

    return await this.contract.invoke('settle_match', calldata);
  }

  async refundMatch(matchId: bigint) {
    return await this.contract.invoke('refund_match', [matchId]);
  }
}

// Event System Contract
export class EventSystemContract {
  private contract: Contract;

  constructor(account: Account) {
    this.contract = new Contract({
      abi: [],
      address: EVENT_SYSTEM_ADDRESS,
      providerOrAccount: account,
      parseRequest: false,
      parseResponse: false,
    });
  }

  async createEvent(
    eventName: string,
    entryFee: bigint,
    maxPlayers: number,
    startsAt: bigint,
    prizeDistribution: [number, number, number]
  ) {
    const calldata = CallData.compile({
      event_name: eventName,
      entry_fee: entryFee,
      max_players: maxPlayers,
      starts_at: startsAt,
      prize_distribution: {
        first: prizeDistribution[0],
        second: prizeDistribution[1],
        third: prizeDistribution[2],
      },
    });

    return await this.contract.invoke('create_event', calldata);
  }

  async joinEvent(eventId: bigint, deck: [bigint, bigint, bigint]) {
    const calldata = CallData.compile({
      event_id: eventId,
      deck: { card_1: deck[0], card_2: deck[1], card_3: deck[2] },
    });

    return await this.contract.invoke('join_event', calldata);
  }

  async startEvent(eventId: bigint) {
    return await this.contract.invoke('start_event', [eventId]);
  }

  async cancelEvent(eventId: bigint) {
    return await this.contract.invoke('cancel_event', [eventId]);
  }
}

// Oracle System Contract (client-side read-only)
export class OracleSystemContract {
  private contract: Contract;

  constructor() {
    const provider = getProvider();

    this.contract = new Contract({
      abi: ORACLE_ABI as any,
      address: ORACLE_SYSTEM_ADDRESS,
      providerOrAccount: provider,
    });
  }

  async checkOracleHealth(
    asset: CardAsset | number | Record<string, any> | CairoCustomEnum
  ): Promise<{ is_healthy: boolean; staleness: bigint }> {
    const enumArg = toCardAssetEnum(asset);

    const result: any = await this.contract.call('check_oracle_health', [enumArg]);

    // output is a tuple: (core::bool, u64)
    const boolRaw = result?.is_healthy ?? result?.['0'] ?? result?.[0];
    const staleRaw = result?.staleness ?? result?.['1'] ?? result?.[1];

    return {
      is_healthy: parseCoreBool(boolRaw),
      staleness: toBigIntSafe(staleRaw, 0n),
    };
  }

  async getPriceForAsset(
    asset: CardAsset | number | Record<string, any> | CairoCustomEnum
  ): Promise<{
    price: bigint;
    decimals: number;
    last_updated_timestamp: bigint;
  }> {
    const enumArg = toCardAssetEnum(asset);

    const result: any = await this.contract.call('get_price_for_asset', [enumArg]);

    // ABI returns struct PriceResponse { price, decimals, last_updated_timestamp }
    const priceRaw = result?.price ?? result?.['0'] ?? result?.[0] ?? '0';
    const decimalsRaw = result?.decimals ?? result?.['1'] ?? result?.[1] ?? 8;
    const tsRaw =
      result?.last_updated_timestamp ?? result?.['2'] ?? result?.[2] ?? '0';

    return {
      price: toBigIntSafe(priceRaw, 0n),
      decimals: toNumberSafe(decimalsRaw, 8),
      last_updated_timestamp: toBigIntSafe(tsRaw, 0n),
    };
  }
}

// Helper to get contract instances
export const getContracts = (account: Account) => ({
  matchSystem: new MatchSystemContract(account),
  escrowSystem: new EscrowSystemContract(account),
  eventSystem: new EventSystemContract(account),
  oracleSystem: new OracleSystemContract(),
});
