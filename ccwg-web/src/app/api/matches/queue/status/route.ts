//ccwg-web/src/app/api/matches/queue/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';

export async function GET(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const supabase = createServiceClient();
    const url = new URL(request.url);

    const sinceRaw = url.searchParams.get('since');
    const parsedSinceMs = sinceRaw ? new Date(sinceRaw).getTime() : Number.NaN;
    const sinceIso = Number.isFinite(parsedSinceMs) ? new Date(parsedSinceMs).toISOString() : null;

    const eventIdRaw = url.searchParams.get('event_id');
    const eventId = eventIdRaw ? Number.parseInt(eventIdRaw, 10) : Number.NaN;

    const roomContextIdRaw = url.searchParams.get('room_context_id');
    const roomContextId = roomContextIdRaw ? Number.parseInt(roomContextIdRaw, 10) : Number.NaN;

    const totalRoundsRaw = url.searchParams.get('total_rounds');
    const totalRounds = totalRoundsRaw ? Number.parseInt(totalRoundsRaw, 10) : Number.NaN;

    let matchQuery: any = supabase
      .from('matches')
      .select('*')
      .eq('mode', 'Ranked1v1')
      .in('status', ['WaitingForOpponent', 'InProgress'])
      .or(`player_1.eq.${wallet},player_2.eq.${wallet}`)
      .order('created_at', { ascending: false });

    if (sinceIso) {
      matchQuery = matchQuery.gte('created_at', sinceIso);
    }

    if (Number.isFinite(eventId)) {
      matchQuery = matchQuery.eq('event_context_id', eventId);
    }

    if (Number.isFinite(roomContextId)) {
      matchQuery = matchQuery.eq('room_context_id', roomContextId);
    }

    if (Number.isFinite(totalRounds)) {
      matchQuery = matchQuery.eq('total_rounds', totalRounds);
    }

    const { data: match } = await matchQuery.limit(1).maybeSingle();

    if (match) {
      await supabase.from('ranked_queue').delete().eq('player_wallet', wallet);
      return NextResponse.json({ match });
    }

    return NextResponse.json({ match: null });
  } catch (error) {
    console.error('Queue status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
