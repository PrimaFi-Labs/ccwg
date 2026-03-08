import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';
import { insertInboxMessages } from '@/src/lib/inbox/service';

/**
 * POST /api/control/inbox - Send a private in-game message to a player.
 * Body: { player_wallet, subject, body, related_room_id? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    const payload = await request.json().catch(() => ({}));
    const playerWallet =
      typeof payload?.player_wallet === 'string' ? payload.player_wallet.trim().toLowerCase() : '';
    const subject = typeof payload?.subject === 'string' ? payload.subject.trim() : '';
    const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
    const relatedRoomId =
      payload?.related_room_id == null ? null : Number.parseInt(String(payload.related_room_id), 10);

    if (!playerWallet) {
      return NextResponse.json({ error: 'player_wallet is required' }, { status: 400 });
    }
    if (!body) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }
    if (relatedRoomId != null && !Number.isFinite(relatedRoomId)) {
      return NextResponse.json({ error: 'Invalid related_room_id' }, { status: 400 });
    }

    const { data: player } = await supabase
      .from('players')
      .select('wallet_address')
      .eq('wallet_address', playerWallet)
      .maybeSingle();

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const finalSubject = subject || 'In-Game Notice';
    await insertInboxMessages(supabase, [
      {
        player_wallet: playerWallet,
        subject: finalSubject,
        body: `${body}\n\nThis is an in-game message.`,
        category: 'system',
        related_room_id: relatedRoomId,
      },
    ]);

    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'send_player_inbox_message',
      table_name: 'player_inbox',
      record_id: playerWallet,
      after_data: {
        player_wallet: playerWallet,
        subject: finalSubject,
        related_room_id: relatedRoomId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin inbox message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
