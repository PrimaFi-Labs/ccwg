import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { maybePurgeExpiredInboxMessages } from '@/src/lib/inbox/service';

/**
 * GET /api/inbox/count — Returns unread count for the current player.
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();
    await maybePurgeExpiredInboxMessages(supabase);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabase as any).from('player_inbox')
      .select('message_id', { count: 'exact', head: true })
      .eq('player_wallet', wallet)
      .eq('is_read', false)
      .gt('expires_at', nowIso);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ unread: count ?? 0 });
  } catch (error) {
    console.error('Inbox count error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
