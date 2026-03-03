// ccwg/ccwg-web/src/app/api/events/join/confirm/route.ts
//
// PHASE 2 — Confirms event registration after on-chain tx succeeds.
//
// The client sends { event_id, tx_hash } after the Starknet multicall
// (approve → deposit_stake → join_event) has been accepted on L2.
// This endpoint verifies the tx receipt, then writes the DB records.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { buildProvider, getWorldAddress } from '@/src/lib/starknet/chain';
import { EVENT_SYSTEM_ADDRESS } from '@/src/types/contracts';
import { validateAndParseAddress } from 'starknet';

const confirmSchema = {
  parse(body: Record<string, unknown>) {
    const event_id = Number(body?.event_id);
    const tx_hash = typeof body?.tx_hash === 'string' ? body.tx_hash.trim() : '';
    if (!Number.isFinite(event_id) || event_id <= 0) throw new Error('Invalid event_id');
    if (!tx_hash || !tx_hash.startsWith('0x') || tx_hash.length < 10) throw new Error('Invalid tx_hash');
    return { event_id, tx_hash };
  },
};

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

function hasMatchingJoinEvent(
  receipt: Record<string, unknown>,
  onChainEventId: number,
  wallet: string
): boolean {
  const events = (receipt.events as Array<Record<string, unknown>> | undefined) ?? [];
  const expectedWorld = normalizeFelt(getWorldAddress());
  const expectedSystem = normalizeFelt(EVENT_SYSTEM_ADDRESS);
  const expectedPlayer = normalizeFelt(wallet);

  for (const ev of events) {
    const fromAddress = normalizeFelt((ev.from_address as string | undefined) ?? '');
    if (fromAddress !== expectedWorld) continue;

    const keys = (ev.keys as string[] | undefined) ?? [];
    if (keys.length < 3 || normalizeFelt(keys[2]) !== expectedSystem) continue;

    const data = (ev.data as string[] | undefined) ?? [];
    // PlayerJoinedEventEvent has 2 #[key] fields: event_id and player.
    if (safeToNumber(data[0]) !== 2) continue;

    const evEventId = safeToNumber(data[1]);
    const evPlayer = normalizeFelt(data[2]);
    if (evEventId === onChainEventId && evPlayer === expectedPlayer) {
      return true;
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, tx_hash } = confirmSchema.parse(body);

    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet;
    let walletLower = wallet.toLowerCase();
    try {
      walletLower = validateAndParseAddress(wallet).toLowerCase();
    } catch {}

    // ------------------------------------------------------------------
    // 1. Verify the transaction on-chain
    // ------------------------------------------------------------------
    const provider = buildProvider();
    let receipt;
    try {
      receipt = await provider.getTransactionReceipt(tx_hash);
    } catch (err) {
      console.error('[join/confirm] Failed to fetch tx receipt:', err);
      return NextResponse.json(
        { error: 'Could not fetch transaction receipt. The tx may still be pending — try again in a few seconds.' },
        { status: 400 }
      );
    }

    // Check execution status — accept SUCCEEDED / ACCEPTED_ON_L2 / ACCEPTED_ON_L1
    const execStatus =
      ('execution_status' in receipt ? (receipt as Record<string, unknown>).execution_status : undefined) as
        | string
        | undefined;
    const finalStatus =
      ('finality_status' in receipt ? (receipt as Record<string, unknown>).finality_status : undefined) as
        | string
        | undefined;

    const isSuccess =
      execStatus === 'SUCCEEDED' ||
      finalStatus === 'ACCEPTED_ON_L2' ||
      finalStatus === 'ACCEPTED_ON_L1';

    if (!isSuccess) {
      return NextResponse.json(
        {
          error: `Transaction not successful. execution_status=${execStatus}, finality_status=${finalStatus}`,
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // 2. Re-validate event + assert tx contains join_event for this wallet
    // ------------------------------------------------------------------
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', event_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const onChainEventId = Number(event.on_chain_id);
    if (!Number.isFinite(onChainEventId) || onChainEventId <= 0) {
      return NextResponse.json(
        { error: 'Event is missing a valid on-chain id' },
        { status: 409 }
      );
    }

    const receiptRecord = receipt as Record<string, unknown>;
    if (!hasMatchingJoinEvent(receiptRecord, onChainEventId, walletLower)) {
      return NextResponse.json(
        {
          error:
            'Transaction receipt does not contain a matching join_event for this wallet and event.',
        },
        { status: 400 }
      );
    }

    // Already joined? — idempotent success
    const { data: existing } = await serviceSupabase
      .from('event_participants')
      .select('id')
      .eq('event_id', event_id)
      .eq('player_wallet', walletLower)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, already_joined: true });
    }

    // ------------------------------------------------------------------
    // 3. Insert the participant record  (DB write happens only here)
    // ------------------------------------------------------------------
    const { data: participant, error: participantError } = await serviceSupabase
      .from('event_participants')
      .insert({
        event_id,
        player_wallet: walletLower,
        war_points: 0,
        total_wins: 0,
        total_draws: 0,
        total_losses: 0,
        total_damage_done: 0,
        total_damage_received: 0,
        final_rank: null,
        prize_won: 0,
      })
      .select()
      .single();

    if (participantError) {
      // Race condition — already inserted between the check and insert
      if (participantError.code === '23505') {
        return NextResponse.json({ success: true, already_joined: true });
      }
      return NextResponse.json({ error: participantError.message }, { status: 500 });
    }

    // 4. Update current_players and prize_pool
    const newPlayerCount = (event.current_players ?? 0) + 1;
    const newPrizePool = (BigInt(event.prize_pool ?? 0) + BigInt(event.entry_fee)).toString();
    await serviceSupabase
      .from('events')
      .update({
        current_players: newPlayerCount,
        prize_pool: newPrizePool as unknown as number,
      })
      .eq('event_id', event_id);

    return NextResponse.json({
      success: true,
      participant,
      tx_hash,
    });
  } catch (error: unknown) {
    console.error('Event join confirm error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
