// ccwg/ccwg-web/src/app/api/events/join/route.ts
//
// PRE-FLIGHT: validates eligibility and returns the on-chain event id + entry
// fee the client needs for the Starknet multicall. Does NOT insert into DB.
//
// The client executes the on-chain tx (approve → deposit_stake → join_event),
// then calls POST /api/events/join/confirm with the tx_hash.  That endpoint
// verifies the transaction succeeded on-chain before writing to the DB.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/src/lib/supabase/server';
import { joinEventSchema } from '@/src/lib/validation/schemas';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';
import { getTopActiveSanction, blocksEvents } from '@/src/lib/sanctions/check';
import { createEventOnChain } from '@/src/lib/starknet/chain';
import { validateAndParseAddress } from 'starknet';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = joinEventSchema.parse(body);

    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet;
    let walletLower = wallet.toLowerCase();
    try {
      walletLower = validateAndParseAddress(wallet).toLowerCase();
    } catch {}

    await ensurePlayerExists(walletLower);

    const activeSanction = await getTopActiveSanction(serviceSupabase, walletLower);
    if (activeSanction && blocksEvents(activeSanction.sanction_type)) {
      return NextResponse.json(
        { error: 'Account restricted from events due to an active sanction.' },
        { status: 403 }
      );
    }

    // Fetch the event
    let { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', validated.event_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.status !== 'Open') {
      return NextResponse.json({ error: 'Event not open for registration' }, { status: 400 });
    }

    // Mirror the on-chain assert: now < game_event.starts_at
    if (new Date(event.starts_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'Registration closed — event has already started' },
        { status: 400 }
      );
    }

    if ((event.current_players ?? 0) >= event.max_players) {
      return NextResponse.json({ error: 'Event is full' }, { status: 400 });
    }

    // ------------------------------------------------------------------
    // Legacy migration: if this event was created before on-chain support,
    // register it on-chain now (only possible when it has no participants yet).
    // ------------------------------------------------------------------
    if (!event.on_chain_id) {
      if ((event.current_players ?? 0) > 0 || BigInt(event.prize_pool ?? 0) > 0n) {
        return NextResponse.json(
          {
            error:
              'Legacy off-chain event already has participants. ' +
              'Recreate the event on-chain before new joins.',
          },
          { status: 409 }
        );
      }

      const onChain = await createEventOnChain({
        eventName: event.event_name,
        entryFee: String(event.entry_fee),
        maxPlayers: event.max_players,
        startsAtIso: event.starts_at,
        prizeDistribution: [
          event.first_place_percent ?? 0,
          event.second_place_percent ?? 0,
          event.third_place_percent ?? 0,
        ],
      });

      const { data: linkedEvent, error: linkErr } = await serviceSupabase
        .from('events')
        .update({ on_chain_id: onChain.onChainId })
        .eq('event_id', event.event_id)
        .select('*')
        .single();

      if (linkErr || !linkedEvent) {
        return NextResponse.json(
          { error: linkErr?.message ?? 'Failed to link event on-chain' },
          { status: 500 }
        );
      }

      event = linkedEvent;
    }

    // Check if player already joined
    const { data: existing } = await serviceSupabase
      .from('event_participants')
      .select('id')
      .eq('event_id', validated.event_id)
      .eq('player_wallet', walletLower)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Already joined this event' }, { status: 400 });
    }

    // Verify SP eligibility
    const { data: player } = await supabase
      .from('players')
      .select('stark_points')
      .eq('wallet_address', walletLower)
      .single();

    if (!player || (player.stark_points ?? 0) <= 0) {
      return NextResponse.json(
        { error: 'Stark Points too low to join events. Play bots to earn SP.' },
        { status: 403 }
      );
    }

    // ------------------------------------------------------------------
    // Pre-flight complete — return the on-chain details the client needs
    // to execute the Starknet multicall.  DB records are written ONLY
    // after the client confirms the tx via /api/events/join/confirm.
    // ------------------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        preflight_only: true,
        needs_on_chain: true,
        contract_call: {
          event_id: event.on_chain_id ?? null,
          entry_fee: event.entry_fee,
        },
        // echo back for the confirm call
        _event_id: event.event_id,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('Event join error:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
