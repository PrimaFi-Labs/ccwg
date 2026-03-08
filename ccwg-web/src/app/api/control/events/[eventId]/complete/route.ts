import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';
import { settleEvent } from '@/src/lib/events/settlement';

export async function POST(
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
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    const result = await settleEvent(supabase, eventIdNum, adminAuth.wallet);

    if (!result.settled) {
      return NextResponse.json({ error: result.error ?? 'Settlement failed' }, { status: 400 });
    }

    // Fetch the updated event to return
    const { data: updated } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', eventIdNum)
      .single();

    return NextResponse.json({ event: updated });
  } catch (error) {
    console.error('Admin event complete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
