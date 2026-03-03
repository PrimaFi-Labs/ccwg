import { Account, CallData, cairo } from 'starknet';
import { toast } from '@cartridge/controller';
import { MARKET_SYSTEM_ADDRESS, STRK_TOKEN_ADDRESS } from '@/src/types/contracts';

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'sepolia';

const safeToast = (payload: Record<string, unknown>) => {
  try {
    toast(payload as any);
  } catch {
    // Ignore toast errors
  }
};

export interface PurchaseResult {
  success: boolean;
  txHash?: string;
  cards?: any[];
  error?: string;
  shouldReveal?: boolean;
}

export async function executePurchase(
  account: Account,
  itemId: number,
  priceWei: string,
  itemName: string
): Promise<PurchaseResult> {
  console.log('[Purchase] === START executePurchase ===');
  console.log('[Purchase] itemId:', itemId, 'priceWei:', priceWei, 'itemName:', itemName);
  console.log('[Purchase] account.address:', account.address);
  console.log('[Purchase] MARKET_SYSTEM_ADDRESS:', MARKET_SYSTEM_ADDRESS);
  console.log('[Purchase] STRK_TOKEN_ADDRESS:', STRK_TOKEN_ADDRESS);
  try {
    safeToast({
      variant: 'transaction',
      status: 'pending',
      isExpanded: false,
    });

    const calls =
      BigInt(priceWei) > BigInt(0)
        ? [
            {
              contractAddress: STRK_TOKEN_ADDRESS,
              entrypoint: 'approve',
              calldata: CallData.compile({
                spender: MARKET_SYSTEM_ADDRESS,
                amount: cairo.uint256(BigInt(priceWei)),
              }),
            },
            {
              contractAddress: MARKET_SYSTEM_ADDRESS,
              entrypoint: 'buy_item',
              calldata: CallData.compile({
                item_id: itemId,
              }),
            },
          ]
        : [
            {
              contractAddress: MARKET_SYSTEM_ADDRESS,
              entrypoint: 'buy_item',
              calldata: CallData.compile({
                item_id: itemId,
              }),
            },
          ];

    console.log('[Purchase] Calls to execute:', JSON.stringify(calls, null, 2));
    console.log('[Purchase] Calling account.execute()...');

    let tx;
    try {
      tx = await account.execute(calls);
    } catch (execErr: any) {
      console.error('[Purchase] account.execute() FAILED:', execErr);
      console.error('[Purchase] Error name:', execErr?.name);
      console.error('[Purchase] Error message:', execErr?.message);
      console.error('[Purchase] Error stack:', execErr?.stack);
      if (execErr?.response) {
        try {
          const respText = typeof execErr.response.text === 'function' ? await execErr.response.text() : JSON.stringify(execErr.response);
          console.error('[Purchase] Error response body:', respText);
        } catch { /* ignore */ }
      }
      if (execErr?.cause) console.error('[Purchase] Error cause:', execErr.cause);
      throw execErr;
    }
    const txHash = tx.transaction_hash;
    console.log('[Purchase] TX submitted, hash:', txHash);

    safeToast({
      variant: 'transaction',
      status: 'confirming',
      isExpanded: true,
    });

    console.log('[Purchase] Waiting for transaction confirmation...');
    let receipt;
    try {
      receipt = await account.waitForTransaction(txHash, {
        retryInterval: 2_000,
        successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
      });
    } catch (waitErr: any) {
      console.error('[Purchase] waitForTransaction FAILED:', waitErr?.message);
      throw waitErr;
    }
    console.log('[Purchase] Receipt received:', JSON.stringify(receipt, null, 2));

    const executionStatus = (receipt as any).execution_status;
    console.log('[Purchase] execution_status:', executionStatus);
    if (executionStatus && executionStatus !== 'SUCCEEDED') {
      const revertReason = (receipt as any).revert_reason || 'unknown';
      console.error('[Purchase] On-chain failure, revert_reason:', revertReason);
      return {
        success: false,
        error: `Market purchase transaction failed on-chain: ${revertReason}`,
      };
    }

    console.log('[Purchase] Calling /api/market/purchase...');
    const apiBody = {
      item_id: itemId,
      tx_hash: txHash,
      player_wallet: account.address,
    };
    console.log('[Purchase] API body:', JSON.stringify(apiBody));

    const response = await fetch('/api/market/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiBody),
    });

    const resultText = await response.text();
    console.log('[Purchase] API response status:', response.status, response.statusText);
    console.log('[Purchase] API response body:', resultText);

    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      return {
        success: false,
        error: `API returned non-JSON: ${resultText.slice(0, 200)}`,
      };
    }

    if (!response.ok || !result.success) {
      console.error('[Purchase] API error:', result.error, result.details);
      return {
        success: false,
        error: result.error || 'Purchase verification failed',
      };
    }

    safeToast({
      variant: 'marketplace',
      action: 'purchased',
      itemName,
    });
    safeToast({
      variant: 'transaction',
      status: 'confirmed',
      isExpanded: false,
    });

    return {
      success: true,
      txHash,
      cards: result.cards,
      shouldReveal: result.item?.reveal_animation ?? false,
    };
  } catch (error: any) {
    console.error('[Purchase] === CAUGHT ERROR in executePurchase ===');
    console.error('[Purchase] Error type:', typeof error);
    console.error('[Purchase] Error name:', error?.name);
    console.error('[Purchase] Error message:', error?.message);
    console.error('[Purchase] Error stack:', error?.stack);
    console.error('[Purchase] Full error:', error);

    let errorMessage = error?.message || 'Purchase failed';
    if (errorMessage.includes('rejected')) errorMessage = 'Transaction rejected by wallet';
    if (errorMessage.includes('insufficient')) errorMessage = 'Insufficient STRK balance';
    if (errorMessage.includes('timeout')) errorMessage = 'Transaction timeout, please retry';
    if (errorMessage.toLowerCase().includes('item inactive')) {
      errorMessage = 'This item is inactive on-chain. Refresh market or contact admin.';
    }

    safeToast({
      variant: 'error',
      message: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function validatePurchase(
  account: Account | undefined,
  priceWei: string
): Promise<{ valid: boolean; error?: string }> {
  if (!account) return { valid: false, error: 'Please connect your wallet' };
  if (BigInt(priceWei) === BigInt(0)) return { valid: true };

  try {
    console.log('[Purchase] validatePurchase: checking balance for', account.address, 'priceWei:', priceWei);
    const balanceResult = await account.callContract({
      contractAddress: STRK_TOKEN_ADDRESS,
      entrypoint: 'balanceOf',
      calldata: [account.address],
    });
    console.log('[Purchase] balanceOf raw result:', balanceResult);

    const low = BigInt(balanceResult[0]);
    const high = BigInt(balanceResult[1]);
    const u128Base = BigInt(2) ** BigInt(128);
    const balance = low + (high * u128Base);
    console.log('[Purchase] Balance:', balance.toString(), 'Required:', priceWei);

    if (balance < BigInt(priceWei)) {
      return {
        valid: false,
        error: `Insufficient STRK balance (have: ${balance.toString()}, need: ${priceWei})`,
      };
    }

    return { valid: true };
  } catch (err: any) {
    console.error('[Purchase] validatePurchase FAILED:', err?.message, err);
    return {
      valid: false,
      error: `Failed to check STRK balance: ${err?.message || 'unknown'}`,
    };
  }
}

export function getStarkscanUrl(txHash: string): string {
  const prefix = NETWORK === 'mainnet' ? '' : 'sepolia.';
  return `https://${prefix}starkscan.co/tx/${txHash}`;
}
