import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { validateAndParseAddress } from 'starknet';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const walletParam = url.searchParams.get('wallet_address');
    if (!walletParam) {
      return NextResponse.json({ error: 'wallet_address is required' }, { status: 400 });
    }

    let wallet = walletParam.toLowerCase();
    try {
      wallet = validateAndParseAddress(walletParam).toLowerCase();
    } catch { /* keep lowercased raw value */ }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('player_achievements')
      .select(`
        unlocked_at,
        achievement_definitions (
          key,
          title,
          description,
          category,
          tier,
          badge_icon,
          badge_color,
          xp_reward,
          sp_reward
        )
      `)
      .eq('player_wallet', wallet)
      .order('unlocked_at', { ascending: false });

    if (error) {
      console.error('[achievements] query error:', error);
      return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 });
    }

    const achievements = (data ?? []).map((row) => ({
      ...(row.achievement_definitions as Record<string, unknown>),
      unlocked_at: row.unlocked_at,
    }));

    return NextResponse.json({ achievements });
  } catch (err) {
    console.error('[achievements] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
