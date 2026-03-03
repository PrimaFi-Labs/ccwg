import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';
import { touchPlayerPresence } from '@/src/lib/social/shared';

export async function GET(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) {
      return NextResponse.json({ players: [] });
    }

    const supabase = createServiceClient();
    await ensurePlayerExists(wallet);
    await touchPlayerPresence(supabase as any, wallet, '/profile');

    let query = (supabase as any)
      .from('players')
      .select('wallet_address, username')
      .neq('wallet_address', wallet)
      .limit(8);

    if (q.startsWith('0x')) {
      query = query.ilike('wallet_address', `${q.toLowerCase()}%`);
    } else {
      query = query.ilike('username', `%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ players: data ?? [] });
  } catch (error) {
    console.error('Player search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
