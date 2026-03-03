import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';

/**
 * POST /api/rooms/dispute — Submit a room dispute ticket.
 * Body: { room_code: string, message: string }
 * Creates a room_disputes row + a linked player_reports row.
 */
export async function POST(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const body = await request.json().catch(() => ({}));
    const roomCode = typeof body?.room_code === 'string' ? body.room_code.trim().toUpperCase() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!roomCode || roomCode.length < 4 || roomCode.length > 12) {
      return NextResponse.json({ error: 'Valid room_code required (4-12 chars)' }, { status: 400 });
    }
    if (!message || message.length < 10 || message.length > 2000) {
      return NextResponse.json({ error: 'Message must be 10-2000 characters' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Look up room by code
    const { data: room } = await supabase
      .from('rooms')
      .select('room_id, room_code, status, destroy_after')
      .eq('room_code', roomCode)
      .maybeSingle();

    if (!room) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    }

    // Only allow disputes during the 24-hour grace period after settlement
    const isConcluded = room.status === 'Completed' || room.status === 'Expired';
    const gracePeriodActive = room.destroy_after && new Date(room.destroy_after).getTime() > Date.now();
    if (!isConcluded || !gracePeriodActive) {
      return NextResponse.json(
        { error: 'Disputes can only be submitted during the 24-hour grace period after a room has concluded.' },
        { status: 403 }
      );
    }

    // Reject duplicate disputes from the same player for the same room
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingDispute } = await (supabase as any)
      .from('room_disputes')
      .select('dispute_id')
      .eq('player_wallet', wallet)
      .eq('room_id', room.room_id)
      .maybeSingle();

    if (existingDispute) {
      return NextResponse.json(
        { error: 'You have already submitted a dispute for this room. An admin will review it.' },
        { status: 409 }
      );
    }

    // Create a player_reports row so it shows in admin reports
    const { data: report, error: reportErr } = await supabase
      .from('player_reports')
      .insert({
        reporter_wallet: wallet,
        reported_wallet: wallet, // self-report (dispute, not accusing another player)
        reason: 'Other',
        details: `[Room Dispute] Room: ${roomCode}\n\n${message}`,
        status: 'Open',
      })
      .select()
      .single();

    if (reportErr) {
      return NextResponse.json({ error: reportErr.message }, { status: 500 });
    }

    // Create the room dispute record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dispute, error: disputeErr } = await (supabase as any)
      .from('room_disputes')
      .insert({
        room_code: roomCode,
        room_id: room?.room_id ?? null,
        player_wallet: wallet,
        message,
        status: 'Open',
        report_id: report.report_id,
      })
      .select()
      .single();

    if (disputeErr) {
      return NextResponse.json({ error: disputeErr.message }, { status: 500 });
    }

    return NextResponse.json({ dispute, report_id: report.report_id });
  } catch (error) {
    console.error('Room dispute error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
