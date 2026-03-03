import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { maybePurgeExpiredInboxMessages } from '@/src/lib/inbox/service';

/**
 * GET /api/inbox — Get the current player's inbox messages.
 * Query params: ?unread_only=true
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unread_only') === 'true';

    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();
    await maybePurgeExpiredInboxMessages(supabase);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any).from('player_inbox')
      .select('*')
      .eq('player_wallet', wallet)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: messages, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error('Inbox fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/inbox — Mark a message as read.
 * Body: { message_id: number }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const body = await request.json().catch(() => ({}));
    const messageId = Number.parseInt(String(body?.message_id || ''), 10);

    if (!Number.isFinite(messageId)) {
      return NextResponse.json({ error: 'Invalid message_id' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('player_inbox')
      .update({ is_read: true })
      .eq('message_id', messageId)
      .eq('player_wallet', wallet);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Inbox mark-read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
