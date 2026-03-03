import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { startRoom } from '@/src/lib/rooms/scheduler';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;

    const { roomId } = await params;
    const roomIdNum = Number.parseInt(roomId, 10);
    if (!Number.isFinite(roomIdNum)) {
      return NextResponse.json({ error: 'Invalid room id' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: room } = await supabase
      .from('rooms')
      .select('host_wallet')
      .eq('room_id', roomIdNum)
      .maybeSingle();

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const wallet = session.wallet.toLowerCase();
    if (room.host_wallet?.toLowerCase() !== wallet) {
      return NextResponse.json({ error: 'Only host can start the room' }, { status: 403 });
    }

    await startRoom(supabase, roomIdNum);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Room start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
