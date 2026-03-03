import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { validateAndParseAddress } from 'starknet';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const walletParam = url.searchParams.get('wallet_address');
    const limitParam = Number.parseInt(url.searchParams.get('limit') || '10', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 10;

    let wallet = walletParam?.toLowerCase() || '';
    if (walletParam) {
      try {
        wallet = validateAndParseAddress(walletParam).toLowerCase();
      } catch {}
    }

    if (!wallet) {
      const session = requireSessionWallet(request);
      if ('response' in session) return session.response;
      try {
        wallet = validateAndParseAddress(session.wallet).toLowerCase();
      } catch {
        wallet = session.wallet.toLowerCase();
      }
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('matches')
      .select(
        'match_id, mode, status, player_1, player_2, winner, created_at, ended_at, ' +
          'p1_rounds_won, p2_rounds_won, total_rounds'
      )
      .or(`player_1.eq.${wallet},player_2.eq.${wallet}`)
      .in('status', ['Completed', 'Cancelled'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ matches: data || [] });
  } catch (error) {
    console.error('Player match history fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
