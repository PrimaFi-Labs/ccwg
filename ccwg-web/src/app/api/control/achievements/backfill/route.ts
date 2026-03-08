// POST /api/control/achievements/backfill
// Admin: backfill achievements for a specific player or all players.
// Body: { wallet_address?: string }  — omit to run for all players (expensive).

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';
import { validateAndParseAddress } from 'starknet';

async function backfillWallet(wallet: string, supabase: ReturnType<typeof createServiceClient>) {
  const { data: defs } = await supabase
    .from('achievement_definitions')
    .select('key, title, description, category, tier, badge_icon, badge_color');
  if (!defs || defs.length === 0) return 0;

  const { data: existing } = await supabase
    .from('player_achievements')
    .select('achievement_key')
    .eq('player_wallet', wallet);
  const unlocked = new Set((existing ?? []).map((r) => r.achievement_key));

  const [
    winsRes, totalRes, aiWinsRes, rankedWinsRes, challengeWinsRes, roomWinsRes,
    cardsRes, cardAssetsRes, level3Res, level5Res, lastMatchesRes,
  ] = await Promise.all([
    supabase.from('matches').select('match_id', { count: 'exact', head: true }).eq('winner', wallet).eq('status', 'Completed'),
    supabase.from('matches').select('match_id', { count: 'exact', head: true }).or(`player_1.eq.${wallet},player_2.eq.${wallet}`).eq('status', 'Completed'),
    supabase.from('matches').select('match_id', { count: 'exact', head: true }).eq('winner', wallet).eq('mode', 'VsAI').eq('status', 'Completed'),
    supabase.from('matches').select('match_id', { count: 'exact', head: true }).eq('winner', wallet).eq('mode', 'Ranked1v1').eq('status', 'Completed'),
    supabase.from('matches').select('match_id', { count: 'exact', head: true }).eq('winner', wallet).eq('mode', 'Challenge').eq('status', 'Completed'),
    supabase.from('matches').select('match_id', { count: 'exact', head: true }).eq('winner', wallet).eq('mode', 'Room').eq('status', 'Completed'),
    supabase.from('player_cards').select('id', { count: 'exact', head: true }).eq('owner_wallet', wallet),
    supabase.from('player_cards').select('template:card_templates!inner(asset)').eq('owner_wallet', wallet),
    supabase.from('player_cards').select('id', { count: 'exact', head: true }).eq('owner_wallet', wallet).gte('level', 3),
    supabase.from('player_cards').select('id', { count: 'exact', head: true }).eq('owner_wallet', wallet).gte('level', 5),
    supabase.from('matches').select('winner').or(`player_1.eq.${wallet},player_2.eq.${wallet}`).eq('status', 'Completed').order('ended_at', { ascending: false }).limit(10),
  ]);

  const wins = winsRes.count ?? 0;
  const played = totalRes.count ?? 0;
  const aiWins = aiWinsRes.count ?? 0;
  const rankedWins = rankedWinsRes.count ?? 0;
  const challengeWins = challengeWinsRes.count ?? 0;
  const roomWins = roomWinsRes.count ?? 0;
  const cardsOwned = cardsRes.count ?? 0;
  const cardAssets = new Set(
    (cardAssetsRes.data ?? []).map(
      (r: { template?: { asset?: string } | null }) => r.template?.asset
    )
  );
  const hasLevel3 = (level3Res.count ?? 0) >= 1;
  const hasLevel5 = (level5Res.count ?? 0) >= 1;
  const lastMatches = lastMatchesRes.data ?? [];
  const streak = (n: number) =>
    lastMatches.length >= n && lastMatches.slice(0, n).every((m) => m.winner === wallet);
  const winRate = played > 0 ? wins / played : 0;

  const { data: legCards } = await supabase
    .from('player_cards')
    .select('id, template:card_templates!inner(rarity)')
    .eq('owner_wallet', wallet);
  const hasLegendary = (legCards ?? []).some(
    (c: { template?: { rarity?: string } | null }) => c.template?.rarity === 'Legendary'
  );

  const CHECKS: Record<string, boolean> = {
    first_blood:       wins === 1,
    destroyer:         wins >= 50,
    warlord:           wins >= 100,
    legend_blade:      wins >= 500,
    tactician:         wins >= 25,
    grandmaster:       played >= 30 && winRate >= 0.7,
    bot_slayer:        aiWins === 1,
    bot_veteran:       aiWins >= 10,
    bot_master:        aiWins >= 50,
    ranked_debut:      rankedWins === 1,
    on_the_rise:       rankedWins >= 5,
    ranked_warrior:    rankedWins >= 25,
    elite_fighter:     rankedWins >= 50,
    first_steps:       played === 1,
    dedicated:         played >= 10,
    veteran:           played >= 50,
    centurion:         played >= 100,
    marathon:          played >= 500,
    hot_streak:        streak(3),
    on_fire:           streak(5),
    unstoppable:       streak(10),
    challenger:        challengeWins >= 1,
    room_warrior:      roomWins >= 1,
    silver_warrior:    wins >= 10,
    all_rounder:       aiWins >= 1 && rankedWins >= 1 && challengeWins >= 1 && roomWins >= 1,
    first_card:        cardsOwned >= 1,
    full_set:          ['BTC', 'ETH', 'STRK', 'SOL', 'DOGE'].every((a) => cardAssets.has(a)),
    legendary_owner:   hasLegendary,
    level_up:          hasLevel3,
    max_power:         hasLevel5,
    arsenal:           cardsOwned >= 10,
  };

  const keysToInsert: string[] = [];
  for (const def of defs) {
    if (unlocked.has(def.key)) continue;
    if (def.key in CHECKS && CHECKS[def.key]) keysToInsert.push(def.key);
  }

  if (keysToInsert.length > 0) {
    await supabase.from('player_achievements').insert(
      keysToInsert.map((key) => ({ player_wallet: wallet, achievement_key: key }))
    );
  }

  // completionist
  const totalNow = unlocked.size + keysToInsert.length;
  if (!unlocked.has('completionist') && !keysToInsert.includes('completionist') && totalNow >= 15) {
    const compDef = defs.find((d) => d.key === 'completionist');
    if (compDef) {
      await supabase.from('player_achievements').insert({ player_wallet: wallet, achievement_key: 'completionist' });
      keysToInsert.push('completionist');
    }
  }

  return keysToInsert.length;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    const body = await request.json().catch(() => ({}));
    const walletParam: string | undefined = body?.wallet_address;

    if (walletParam) {
      // Single player
      let wallet = walletParam.toLowerCase();
      try { wallet = validateAndParseAddress(walletParam).toLowerCase(); } catch { /* ok */ }

      const awarded = await backfillWallet(wallet, supabase);
      return NextResponse.json({ wallets_processed: 1, total_awarded: awarded });
    }

    // All players — paginate to avoid memory issues
    let offset = 0;
    const PAGE = 50;
    let totalProcessed = 0;
    let totalAwarded = 0;

    while (true) {
      const { data: players } = await supabase
        .from('players')
        .select('wallet_address')
        .range(offset, offset + PAGE - 1);

      if (!players || players.length === 0) break;

      for (const p of players) {
        const awarded = await backfillWallet(p.wallet_address, supabase);
        totalAwarded += awarded;
        totalProcessed++;
      }

      if (players.length < PAGE) break;
      offset += PAGE;
    }

    return NextResponse.json({ wallets_processed: totalProcessed, total_awarded: totalAwarded });
  } catch (err) {
    console.error('[admin/backfill] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
