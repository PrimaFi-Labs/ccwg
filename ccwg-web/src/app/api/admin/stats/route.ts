import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator', 'Analyst']);
    if ('response' in adminAuth) return adminAuth.response;

    // Fetch dashboard stats
    const [playersResult, cardsResult, matchesResult, eventsResult, marketItemsResult, revenueResult] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }),
      supabase.from('player_cards').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'InProgress'),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('market_items').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase
        .from('transactions')
        .select('amount', { count: 'exact' })
        .eq('tx_type', 'market_purchase'),
    ]);

    const totalRevenue = (revenueResult.data || [])
      .reduce((acc, row) => acc + BigInt(row.amount || '0'), 0n)
      .toString();

    const sinceMidnight = new Date();
    sinceMidnight.setHours(0, 0, 0, 0);

    const { count: matchesToday } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sinceMidnight.toISOString());

    const { data: recentMatches } = await supabase
      .from('matches')
      .select('match_id, player_1, player_2, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentPurchases } = await supabase
      .from('transactions')
      .select('tx_id, player_wallet, amount, created_at')
      .eq('tx_type', 'market_purchase')
      .order('created_at', { ascending: false })
      .limit(5);

    const stats = {
      total_players: playersResult.count || 0,
      total_cards_issued: cardsResult.count || 0,
      active_matches: matchesResult.count || 0,
      total_events: eventsResult.count || 0,
      total_revenue_strk: totalRevenue,
      cards_in_circulation: cardsResult.count || 0,
      market_items_active: marketItemsResult.count || 0,
      matches_today: matchesToday || 0,
      recent_matches: recentMatches || [],
      recent_purchases: recentPurchases || [],
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
