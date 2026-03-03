import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';

export async function GET(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('room_members')
      .select('status, rooms(*)')
      .eq('player_wallet', wallet)
      .neq('status', 'Quit');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rooms = (data || [])
      .map((row) => {
        const room = (row as any).rooms;
        if (!room) return null;
        return { ...room, member_status: row.status };
      })
      .filter(Boolean);

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Rooms mine error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
