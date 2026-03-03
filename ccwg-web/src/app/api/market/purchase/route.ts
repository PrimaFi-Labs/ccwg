import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/src/lib/supabase/server';
import { RpcProvider, validateAndParseAddress } from 'starknet';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';
import { MARKET_SYSTEM_ADDRESS } from '@/src/types/contracts';
import { getWorldAddress } from '@/src/lib/starknet/chain';

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'sepolia';
const RPC_URL =
  process.env.RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.NEXT_PUBLIC_STARKNET_RPC_URL ||
  'https://api.cartridge.gg/x/starknet/sepolia';

interface PurchaseRequest {
  item_id: number;
  tx_hash: string;
  player_wallet: string;
}

const provider = new RpcProvider({ nodeUrl: RPC_URL });

function normalizeFelt(value?: string): string {
  if (!value) return '';
  const lower = value.toLowerCase().trim();
  if (!lower.startsWith('0x')) return lower;
  const hex = lower.slice(2).replace(/^0+/, '') || '0';
  return `0x${hex}`;
}

function safeToNumber(value?: string): number | undefined {
  if (!value) return undefined;
  try {
    const n = Number(BigInt(value));
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

async function verifyMarketPurchase(
  txHash: string,
  itemId: number,
  buyerWallet: string
): Promise<{ valid: boolean; error?: string }> {
  console.log('[API/verify] verifyMarketPurchase txHash:', txHash, 'itemId:', itemId, 'buyer:', buyerWallet);
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    console.log('[API/verify] Receipt received:', receipt ? 'yes' : 'null');
    if (!receipt) return { valid: false, error: 'Transaction not found' };

    const executionStatus =
      (receipt as any).execution_status ??
      (receipt as any).finality_status;
    console.log('[API/verify] executionStatus:', executionStatus);

    const isSuccess =
      executionStatus === 'SUCCEEDED' ||
      executionStatus === 'ACCEPTED_ON_L2' ||
      executionStatus === 'ACCEPTED_ON_L1';

    if (!isSuccess) {
      console.error('[API/verify] TX not successful. Status:', executionStatus, 'revert_reason:', (receipt as any).revert_reason);
      return { valid: false, error: `Transaction not successful (status: ${executionStatus}, revert: ${(receipt as any).revert_reason || 'none'})` };
    }

    const worldAddress = normalizeFelt(getWorldAddress());
    const marketAddress = normalizeFelt(MARKET_SYSTEM_ADDRESS);
    const buyer = normalizeFelt(validateAndParseAddress(buyerWallet));
    console.log('[API/verify] Matching events: worldAddress:', worldAddress, 'marketAddress:', marketAddress, 'buyer:', buyer);

    const events = 'events' in receipt ? (receipt as any).events || [] : [];
    console.log('[API/verify] Total events in receipt:', events.length);
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      console.log(`[API/verify] Event[${i}]:`, { from: normalizeFelt(ev.from_address), keys: ev.keys?.map((k: string) => normalizeFelt(k)), data: ev.data });
      if (normalizeFelt(ev.from_address) !== worldAddress) continue;
      if (!Array.isArray(ev.keys) || ev.keys.length < 3) continue;
      if (normalizeFelt(ev.keys[2]) !== marketAddress) continue;
      if (!Array.isArray(ev.data) || ev.data.length < 3) continue;

      // Dojo envelope: data[0] = keys_len, then key values in data[1..keys_len]
      const keysLen = safeToNumber(ev.data[0]);
      if (keysLen !== 2) continue;

      const eventItemId = safeToNumber(ev.data[1]);
      const eventBuyer = normalizeFelt(ev.data[2]);
      console.log(`[API/verify] Candidate event: itemId=${eventItemId}, buyer=${eventBuyer}`);

      if (eventItemId === itemId && eventBuyer === buyer) {
        console.log('[API/verify] MATCH FOUND - purchase verified');
        return { valid: true };
      }
    }

    console.error('[API/verify] No matching event found');
    return { valid: false, error: 'Market purchase event not found in receipt' };
  } catch (error: any) {
    console.error('[API/verify] EXCEPTION:', error?.message, error?.stack);
    return { valid: false, error: error?.message || 'Transaction verification failed' };
  }
}

function distributeCards(
  guaranteedCards: number[] | null,
  possibleCards: number[] | null,
  cardWeights: Record<string, number> | null,
  totalCards: number
): number[] {
  const result: number[] = [];

  if (guaranteedCards && guaranteedCards.length > 0) {
    result.push(...guaranteedCards);
  }

  const remainingCount = totalCards - result.length;
  if (remainingCount <= 0) return result.slice(0, totalCards);

  const randomPool = possibleCards?.filter((id) => !guaranteedCards?.includes(id)) || possibleCards || [];
  if (randomPool.length === 0) return result;

  if (cardWeights && Object.keys(cardWeights).length > 0) {
    const totalWeight = Object.values(cardWeights).reduce((sum, w) => sum + w, 0);
    for (let i = 0; i < remainingCount; i += 1) {
      let random = Math.random() * totalWeight;
      for (const [templateIdStr, weight] of Object.entries(cardWeights)) {
        const templateId = Number.parseInt(templateIdStr, 10);
        if (!randomPool.includes(templateId)) continue;
        random -= weight;
        if (random <= 0) {
          result.push(templateId);
          break;
        }
      }
    }
  } else {
    for (let i = 0; i < remainingCount; i += 1) {
      const randomIndex = Math.floor(Math.random() * randomPool.length);
      result.push(randomPool[randomIndex]);
    }
  }

  return result.slice(0, totalCards);
}

export async function POST(request: NextRequest) {
  console.log('[API/purchase] === POST /api/market/purchase ===');
  try {
    const body = (await request.json()) as PurchaseRequest;
    const { item_id, tx_hash, player_wallet } = body;
    console.log('[API/purchase] body:', { item_id, tx_hash, player_wallet });

    let normalizedWallet = player_wallet?.toLowerCase();
    if (player_wallet) {
      try {
        normalizedWallet = validateAndParseAddress(player_wallet).toLowerCase();
      } catch {
        // fallback to provided value
      }
    }

    if (!item_id || !tx_hash || !normalizedWallet) {
      console.error('[API/purchase] Missing fields:', { item_id, tx_hash, normalizedWallet });
      return NextResponse.json(
        { error: 'Missing required fields: item_id, tx_hash, player_wallet' },
        { status: 400 }
      );
    }

    console.log('[API/purchase] normalizedWallet:', normalizedWallet);
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();
    await ensurePlayerExists(normalizedWallet);
    console.log('[API/purchase] Player ensured, fetching market item:', item_id);

    const { data: item, error: itemError } = await supabase
      .from('market_items')
      .select('*')
      .eq('item_id', item_id)
      .eq('is_active', true)
      .single();

    if (itemError || !item) {
      console.error('[API/purchase] Item not found. itemError:', itemError, 'item_id:', item_id);
      return NextResponse.json({ error: 'Item not found or inactive' }, { status: 404 });
    }
    console.log('[API/purchase] Item found:', item.name, 'price:', item.price_strk, 'cards_granted:', item.cards_granted);

    if (item.per_wallet_limit && item.per_wallet_limit > 0) {
      const { count: purchaseCount } = await serviceSupabase
        .from('purchase_history')
        .select('*', { count: 'exact', head: true })
        .eq('player_wallet', normalizedWallet)
        .eq('item_id', item_id);

      if ((purchaseCount || 0) >= item.per_wallet_limit) {
        return NextResponse.json({ error: 'Purchase limit reached for this item' }, { status: 400 });
      }
    }

    const { data: existingTx } = await serviceSupabase
      .from('purchase_history')
      .select('purchase_id')
      .eq('tx_hash', tx_hash)
      .maybeSingle();

    if (existingTx) {
      return NextResponse.json({ error: 'Transaction already processed' }, { status: 400 });
    }

    console.log('[API/purchase] Verifying on-chain tx:', tx_hash, 'for item:', item_id, 'buyer:', normalizedWallet);
    console.log('[API/purchase] Using RPC_URL:', RPC_URL);
    const verification = await verifyMarketPurchase(tx_hash, item_id, normalizedWallet);
    console.log('[API/purchase] Verification result:', verification);
    if (!verification.valid) {
      console.error('[API/purchase] Verification FAILED:', verification.error);
      return NextResponse.json(
        { error: verification.error || 'Purchase verification failed' },
        { status: 400 }
      );
    }

    const cardsGranted = Number(item.cards_granted ?? 0);
    if (!Number.isFinite(cardsGranted) || cardsGranted <= 0) {
      return NextResponse.json(
        { error: 'Invalid item configuration - cards_granted must be > 0' },
        { status: 500 }
      );
    }

    const templateIds = distributeCards(
      (item.guaranteed_cards as number[] | null) || null,
      (item.possible_cards as number[] | null) || null,
      (item.card_weights as Record<string, number> | null) || null,
      cardsGranted
    );

    if (templateIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid item configuration - no cards to grant' },
        { status: 500 }
      );
    }

    const { data: ownedTemplatesBefore } = await serviceSupabase
      .from('player_cards')
      .select('template_id')
      .eq('owner_wallet', normalizedWallet);
    const ownedTemplateSet = new Set((ownedTemplatesBefore || []).map((row) => row.template_id));

    const { data: createdCards, error: cardsError } = await serviceSupabase
      .from('player_cards')
      .insert(
        templateIds.map((template_id) => ({
          owner_wallet: normalizedWallet,
          template_id,
          level: 1,
          merge_count: 0,
        }))
      )
      .select(`
        id,
        owner_wallet,
        template_id,
        level,
        merge_count,
        acquired_at,
        template:card_templates(*)
      `);

    if (cardsError || !createdCards) {
      return NextResponse.json(
        { error: `Failed to grant cards: ${cardsError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    const createdCardsWithNew = createdCards.map((card) => ({
      ...card,
      is_new: !ownedTemplateSet.has(card.template_id),
    }));

    await serviceSupabase.from('purchase_history').insert({
      player_wallet: normalizedWallet,
      item_id,
      tx_hash,
      amount_paid: item.price_strk,
      cards_received: createdCards.map((c) => c.id),
    });

    return NextResponse.json({
      success: true,
      cards: createdCardsWithNew,
      item: {
        name: item.name,
        reveal_animation: item.reveal_animation,
      },
      debug: {
        templateIds,
      },
    });
  } catch (error: any) {
    console.error('[API/purchase] === UNHANDLED ERROR ===');
    console.error('[API/purchase] Error message:', error?.message);
    console.error('[API/purchase] Error stack:', error?.stack);
    console.error('[API/purchase] Full error:', error);
    return NextResponse.json(
      {
        error: 'Purchase failed',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'marketplace-purchase',
    status: 'operational',
    network: NETWORK,
    market_system: MARKET_SYSTEM_ADDRESS,
    timestamp: new Date().toISOString(),
  });
}
