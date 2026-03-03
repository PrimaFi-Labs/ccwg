//ccwg-web/src/lib/cartridge/utils.ts

import { uint256 } from 'starknet';

// Convert STRK amount (with 18 decimals) to wei
export const strkToWei = (amount: string | number): bigint => {
  const amountStr = amount.toString();
  const [whole, decimal = ''] = amountStr.split('.');
  
  const decimals = 18;
  const paddedDecimal = decimal.padEnd(decimals, '0').slice(0, decimals);
  
  return BigInt(whole + paddedDecimal);
};

// Convert wei to STRK amount
export const weiToStrk = (wei: bigint | string): string => {
  const weiStr = wei.toString();
  const decimals = 18;
  
  if (weiStr.length <= decimals) {
    return '0.' + weiStr.padStart(decimals, '0');
  }
  
  const whole = weiStr.slice(0, -decimals);
  const decimal = weiStr.slice(-decimals);
  
  return whole + '.' + decimal.replace(/0+$/, '') || '0';
};

// Format STRK for display (2 decimal places)
export const formatStrk = (wei: bigint | string): string => {
  const strk = parseFloat(weiToStrk(wei));
  return strk.toFixed(2);
};

// Convert uint256 to bigint
export const u256ToBigInt = (u256: { low: bigint; high: bigint }): bigint => {
  return u256.low + (u256.high << 128n);
};

// Convert bigint to uint256
export const bigIntToU256 = (value: bigint) => {
  return uint256.bnToUint256(value);
};

// Shorten address for display
export const shortenAddress = (address: string, chars = 4): string => {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

// Format timestamp to readable date
export const formatTimestamp = (timestamp: number | string): string => {
  const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) * 1000 : timestamp * 1000);
  return date.toLocaleString();
};

// Calculate time remaining
export const getTimeRemaining = (endTimestamp: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
} => {
  const now = Math.floor(Date.now() / 1000);
  const remaining = endTimestamp - now;
  
  if (remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }
  
  return {
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
    isExpired: false,
  };
};

// Asset enum to contract felt252
export const assetToFelt252 = (asset: string): number => {
  const mapping: Record<string, number> = {
    BTC: 0,
    ETH: 1,
    STRK: 2,
    SOL: 3,
    DOGE: 4,
  };
  return mapping[asset] || 0;
};

// StakeTier to contract enum
export const stakeTierToEnum = (tier: string): number => {
  const mapping: Record<string, number> = {
    Tier10: 0,
    Tier20: 1,
    Tier100: 2,
  };
  return mapping[tier] || 0;
};

// Generate client nonce for action validation
export const generateNonce = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Hash transcript for match settlement
export const hashTranscript = (
  matchId: number,
  rounds: Array<{
    roundNumber: number;
    p1Action: string;
    p2Action: string;
    winner: string;
  }>
): string => {
  // Simple implementation - in production, use proper hashing
  const data = JSON.stringify({ matchId, rounds });
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
};