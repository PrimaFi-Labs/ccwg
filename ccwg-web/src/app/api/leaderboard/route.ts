import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';

type LeaderboardRow = {
  wallet_address: string;
  username: string | null;
  stark_points: number;
};

async function computeRank(
  supabase: Awaited<ReturnType<typeof createClient>>,
  walletAddress: string,
  starkPoints: number
): Promise<number> {
  const [higherResult, tieBeforeResult] = await Promise.all([
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .gt('stark_points', starkPoints),
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('stark_points', starkPoints)
      .lt('wallet_address', walletAddress),
  ]);

  if (higherResult.error) {
    throw new Error(higherResult.error.message);
  }
  if (tieBeforeResult.error) {
    throw new Error(tieBeforeResult.error.message);
  }

  return (higherResult.count ?? 0) + (tieBeforeResult.count ?? 0) + 1;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const walletAddress = searchParams.get('wallet_address')?.trim() || '';
    const rawLimit = parseInt(searchParams.get('limit') || (q ? '25' : '100'), 10);
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 100, 1), 200);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    const supabase = await createClient();

    let query = supabase
      .from('players')
      .select('wallet_address, username, stark_points')
      .order('stark_points', { ascending: false })
      .order('wallet_address', { ascending: true });

    if (q) {
      query = query.or(`username.ilike.%${q}%,wallet_address.ilike.%${q}%`);
    }

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as LeaderboardRow[];

    const leaderboard = await Promise.all(
      rows.map(async (row, index) => {
        // For filtered search results, return true global rank.
        if (q) {
          const rank = await computeRank(supabase, row.wallet_address, row.stark_points);
          return { ...row, rank };
        }
        // For unfiltered list ordered by points+wallet, index rank is stable and fast.
        return { ...row, rank: offset + index + 1 };
      })
    );

    let myRank: number | null = null;
    if (walletAddress) {
      const { data: me, error: meError } = await supabase
        .from('players')
        .select('wallet_address, stark_points')
        .eq('wallet_address', walletAddress.toLowerCase())
        .maybeSingle();

      if (!meError && me) {
        myRank = await computeRank(supabase, me.wallet_address, me.stark_points);
      }
    }

    return NextResponse.json({ leaderboard, my_rank: myRank });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
