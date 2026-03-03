import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { getSessionWallet } from '@/src/lib/auth/session';
import { syncEventStatuses } from '@/src/lib/events/status';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const eventIdNum = Number.parseInt(eventId, 10);
    if (!Number.isFinite(eventIdNum)) {
      return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const wallet = getSessionWallet(request)?.toLowerCase() ?? null;
    await syncEventStatuses(supabase);

    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', eventIdNum)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    let isRegistered = false;
    if (wallet) {
      const { data: participant } = await supabase
        .from('event_participants')
        .select('id')
        .eq('event_id', eventIdNum)
        .in('player_wallet', [wallet, wallet.toLowerCase()])
        .maybeSingle();
      isRegistered = Boolean(participant);
    }

    return NextResponse.json({
      event: {
        ...event,
        is_registered: isRegistered,
      },
    });
  } catch (error) {
    console.error('Event fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
