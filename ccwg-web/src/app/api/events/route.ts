import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { getSessionWallet } from '@/src/lib/auth/session';
import { runEventMaintenance } from '@/src/lib/events/maintenance';

export async function GET(_request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const wallet = getSessionWallet(_request)?.toLowerCase() ?? null;
    await runEventMaintenance(supabase);

    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let registeredEventIds = new Set<number>();

    if (wallet) {
      const { data: registrations } = await supabase
        .from('event_participants')
        .select('event_id')
        .in('player_wallet', [wallet, wallet.toLowerCase()]);

      registeredEventIds = new Set((registrations || []).map((row) => Number(row.event_id)));
    }

    const eventsWithRegistration = (events || []).map((event) => ({
      ...event,
      is_registered: registeredEventIds.has(Number(event.event_id)),
    }));

    return NextResponse.json({ events: eventsWithRegistration });
  } catch (error) {
    console.error('Events fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
