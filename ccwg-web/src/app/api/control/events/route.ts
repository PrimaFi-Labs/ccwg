// ccwg/ccwg-web/src/app/api/control/events/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';
import { createEventSchema } from '@/src/lib/validation/schemas';
import { createEventOnChain } from '@/src/lib/starknet/chain';
import { runEventMaintenance } from '@/src/lib/events/maintenance';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator', 'Analyst']);
    if ('response' in adminAuth) return adminAuth.response;
    await runEventMaintenance(supabase);

    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .in('status', ['Open', 'InProgress'])
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Admin events fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    const body = await request.json();
    const validated = createEventSchema.parse(body);

    // Validate required fields
    if (!validated.event_name || validated.max_players < 3) {
      return NextResponse.json({ error: 'Invalid event data' }, { status: 400 });
    }

    // Validate prize percentages total exactly 100% (expressed as basis points: 10 000)
    const totalPercent =
      validated.first_place_percent +
      validated.second_place_percent +
      validated.third_place_percent;

    if (totalPercent !== 10000) {
      return NextResponse.json(
        { error: 'Prize percentages must total 100% (10 000 basis points)' },
        { status: 400 }
      );
    }

    // createEventOnChain executes the Dojo system transaction and extracts the
    // new event's ID from the receipt — it no longer uses callContract (which
    // would fail with an ACL error because create_event is not a view function).
    const onChain = await createEventOnChain({
      eventName: validated.event_name,
      entryFee: validated.entry_fee,
      maxPlayers: validated.max_players,
      startsAtIso: validated.starts_at,
      prizeDistribution: [
        validated.first_place_percent,
        validated.second_place_percent,
        validated.third_place_percent,
      ],
    });

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        on_chain_id: onChain.onChainId,
        event_name: validated.event_name,
        entry_fee: Number(validated.entry_fee),
        max_players: validated.max_players,
        total_rounds: validated.total_rounds,
        prize_pool: 0,
        sp_reward: validated.sp_reward,
        first_place_percent: validated.first_place_percent,
        second_place_percent: validated.second_place_percent,
        third_place_percent: validated.third_place_percent,
        starts_at: validated.starts_at,
        ends_at: validated.ends_at,
        status: 'Open',
        current_players: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Event creation DB error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ event, on_chain_tx: onChain.txHash }, { status: 201 });
  } catch (error: unknown) {
    console.error('Admin event creation error:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
