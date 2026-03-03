// ccwg-web/server/oracle-system.ts

import { Contract, RpcProvider, CairoCustomEnum } from 'starknet';
import { ORACLE_SYSTEM_ADDRESS } from '@ccwg/shared';
import fs from 'node:fs';
import path from 'node:path';

type OracleAsset = 'BTC' | 'ETH' | 'STRK' | 'SOL' | 'DOGE';

type PriceResponse = {
  price: bigint;
  decimals: number;
  last_updated_timestamp: bigint;
};

type HealthResponse = {
  is_healthy: boolean;
  staleness: bigint;
};

const BIGINT_ZERO = BigInt(0);

function getRpcUrl(): string {
  const url =
    process.env.STARKNET_RPC_URL ||
    process.env.NEXT_PUBLIC_CARTRIDGE_RPC ||
    '';

  if (!url) {
    throw new Error(
      'Missing STARKNET_RPC_URL (recommended) or NEXT_PUBLIC_CARTRIDGE_RPC for WS server'
    );
  }

  return url;
}

function loadOracleAbi(): unknown[] {
  const relPath =
    process.env.ORACLE_ABI_PATH || 'src/abis/oracle_system.abi.json';
  const absPath = path.resolve(process.cwd(), relPath);

  console.log(`[OracleSystemContractServer] Loading ABI from: ${absPath}`);

  if (!fs.existsSync(absPath)) {
    throw new Error(
      `Oracle ABI not found at: ${absPath}. Put ABI at src/abis/oracle_system.abi.json or set ORACLE_ABI_PATH.`
    );
  }

  const raw = fs.readFileSync(absPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Oracle ABI JSON must be an array.');
  }

  return parsed;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function toBigIntSafe(v: unknown, fallback: bigint): bigint {
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

function assetFromIndex(asset: number): OracleAsset {
  switch (asset) {
    case 0:
      return 'BTC';
    case 1:
      return 'ETH';
    case 2:
      return 'STRK';
    case 3:
      return 'SOL';
    case 4:
      return 'DOGE';
    default:
      throw new Error(`Invalid asset index: ${asset}`);
  }
}

/**
 * ✅ starknet.js v9: custom Cairo enums must be CairoCustomEnum instances
 * (unit variants use {} payload)
 */
function encodeAssetEnum(asset: OracleAsset): CairoCustomEnum {
  return new CairoCustomEnum({ [asset]: {} });
}

/**
 * Cairo core::bool may come back as:
 * - boolean
 * - 0/1
 * - bigint 0/1
 * - "0"/"1"
 * - { True: {} } / { False: {} }
 * - CairoCustomEnum for core::bool (activeVariant() => 'True'/'False')
 */
function parseCoreBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'bigint') return v !== BigInt(0);
  if (typeof v === 'string') return v !== '0' && v.toLowerCase() !== 'false';

  if (v && typeof v === 'object') {
    const anyV = v as any;

    // CairoCustomEnum instance
    if (anyV instanceof CairoCustomEnum && typeof anyV.activeVariant === 'function') {
      return anyV.activeVariant() === 'True';
    }

    // enum-like object
    if (typeof anyV.activeVariant === 'function') {
      return anyV.activeVariant() === 'True';
    }
    if ('True' in anyV) return true;
    if ('False' in anyV) return false;
  }

  return false;
}

export class OracleSystemContractServer {
  private contract: Contract;

  constructor() {
    const provider = new RpcProvider({ nodeUrl: getRpcUrl() });
    const abi = loadOracleAbi();

    console.log(
      '[OracleSystemContractServer] ABI loaded:',
      Array.isArray(abi),
      'len:',
      abi.length
    );

    this.contract = new Contract({
      abi: abi as any,
      address: ORACLE_SYSTEM_ADDRESS,
      providerOrAccount: provider,
    });
  }

  async getPriceForAsset(asset: number): Promise<PriceResponse> {
    const symbol = assetFromIndex(asset);
    const enumArg = encodeAssetEnum(symbol);

    const result: unknown = await this.contract.call(
      'get_price_for_asset',
      [enumArg]
    );

    if (isObject(result)) {
      const r: any = result;
      return {
        price: toBigIntSafe(r.price, BIGINT_ZERO),
        decimals: toNumberSafe(r.decimals, 8),
        last_updated_timestamp: toBigIntSafe(r.last_updated_timestamp, BIGINT_ZERO),
      };
    }

    if (Array.isArray(result)) {
      return {
        price: toBigIntSafe(result[0], BIGINT_ZERO),
        decimals: toNumberSafe(result[1], 8),
        last_updated_timestamp: toBigIntSafe(result[2], BIGINT_ZERO),
      };
    }

    return { price: BIGINT_ZERO, decimals: 8, last_updated_timestamp: BIGINT_ZERO };
  }

  async checkOracleHealth(asset: number): Promise<HealthResponse> {
    const symbol = assetFromIndex(asset);
    const enumArg = encodeAssetEnum(symbol);

    const result: unknown = await this.contract.call(
      'check_oracle_health',
      [enumArg]
    );

    if (Array.isArray(result)) {
      return {
        is_healthy: parseCoreBool(result[0]),
        staleness: toBigIntSafe(result[1], BIGINT_ZERO),
      };
    }

    if (isObject(result)) {
      const r: any = result;
      const boolRaw = r.is_healthy ?? r[0];
      const staleRaw = r.staleness ?? r[1];
      return {
        is_healthy: parseCoreBool(boolRaw),
        staleness: toBigIntSafe(staleRaw, BIGINT_ZERO),
      };
    }

    return { is_healthy: false, staleness: BIGINT_ZERO };
  }
}
