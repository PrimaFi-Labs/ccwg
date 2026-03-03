import { NextRequest, NextResponse } from 'next/server';
import { RpcProvider, validateAndParseAddress } from 'starknet';
import { STRK_TOKEN_ADDRESS } from '@/src/types/contracts';

const STRK_TOKEN = STRK_TOKEN_ADDRESS as `0x${string}`;

const RPC_URL =
  process.env.RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.NEXT_PUBLIC_STARKNET_RPC_URL ||
  'https://api.cartridge.gg/x/starknet/sepolia';

const provider = new RpcProvider({ nodeUrl: RPC_URL });

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const walletParam = url.searchParams.get('wallet_address');

    if (!walletParam) {
      return NextResponse.json({ error: 'Missing wallet_address' }, { status: 400 });
    }

    const wallet = validateAndParseAddress(walletParam);

    const result = await provider.callContract({
      contractAddress: STRK_TOKEN,
      entrypoint: 'balanceOf',
      calldata: [wallet],
    });

    const low = BigInt(result[0]);
    const high = BigInt(result[1]);
    const balance = low + (high << 128n);

    return NextResponse.json({ balance: balance.toString() });
  } catch (error: any) {
    console.error('Balance fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
