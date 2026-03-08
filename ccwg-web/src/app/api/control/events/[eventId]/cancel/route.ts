import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';
import { cancelEventOnChain } from '@/src/lib/starknet/chain';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId: eventIdRaw } = await params;
    const eventId = Number.parseInt(eventIdRaw, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    const { data: before } = await supabase
      .from('events')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (!before) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (before.on_chain_id) {
      try {
        await cancelEventOnChain(before.on_chain_id);
      } catch (onChainError: any) {
        return NextResponse.json(
          { error: onChainError?.message || 'Failed to cancel event on-chain' },
          { status: 500 }
        );
      }
    }

    const { data: updated, error } = await supabase
      .from('events')
      .update({ status: 'Cancelled' })
      .eq('event_id', eventId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'cancel_event',
      table_name: 'events',
      record_id: eventId.toString(),
      before_data: before,
      after_data: updated,
    });

    return NextResponse.json({ event: updated });
  } catch (error) {
    console.error('Event cancel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
