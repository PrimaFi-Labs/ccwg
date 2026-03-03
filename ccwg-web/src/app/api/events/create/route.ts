// ccwg/ccwg-web/src/app/api/events/create/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { createEventSchema } from '@/src/lib/validation/schemas';
import { requireAdmin } from '@/src/lib/auth/guards';
import { createEventOnChain } from '@/src/lib/starknet/chain';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createEventSchema.parse(body);

    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin']);
    if ('response' in adminAuth) return adminAuth.response;

    // Validate prize distribution sums to 100% (10 000 basis points)
    const totalPercent =
      validated.first_place_percent +
      validated.second_place_percent +
      validated.third_place_percent;

    if (totalPercent !== 10000) {
      return NextResponse.json(
        { error: 'Prize distribution must sum to 100% (10 000 basis points)' },
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
        current_players: 0,
        prize_pool: 0,
        status: 'Open',
        sp_reward: validated.sp_reward,
        first_place_percent: validated.first_place_percent,
        second_place_percent: validated.second_place_percent,
        third_place_percent: validated.third_place_percent,
        starts_at: validated.starts_at,
        ends_at: validated.ends_at,
      })
      .select()
      .single();

    if (error) {
      console.error('Event creation DB error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'create_event',
      table_name: 'events',
      record_id: event.event_id.toString(),
      after_data: event,
    });

    return NextResponse.json({ event, on_chain_tx: onChain.txHash });
  } catch (error: any) {
    console.error('Event creation error:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
