//ccwg-web/src/app/api/events/[eventId]/leaderboard/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const eventIdNum = Number.parseInt(eventId, 10);
    if (!Number.isFinite(eventIdNum)) {
      return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: participants, error } = await supabase
      .from('event_participants')
      .select(`
        *,
        player:players!event_participants_player_wallet_fkey(wallet_address, username, stark_points)
      `)
      .eq('event_id', eventIdNum)
      .returns<Array<{
        id: number;
        event_id: number;
        player_wallet: string;
        war_points: number | null;
        total_draws: number | null;
        total_losses: number | null;
        total_damage_done: number | null;
        total_wins: number | null;
        total_damage_received: number | null;
        joined_at: string | null;
        player: { wallet_address: string; username: string | null; stark_points: number | null } | null;
      }>>();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const leaderboard = (participants || [])
      .sort((a, b) => {
        const pointsDiff = (b.war_points ?? 0) - (a.war_points ?? 0);
        if (pointsDiff !== 0) return pointsDiff;

        const winsDiff = (b.total_wins ?? 0) - (a.total_wins ?? 0);
        if (winsDiff !== 0) return winsDiff;

        const drawsDiff = (b.total_draws ?? 0) - (a.total_draws ?? 0);
        if (drawsDiff !== 0) return drawsDiff;

        const lossesDiff = (a.total_losses ?? 0) - (b.total_losses ?? 0);
        if (lossesDiff !== 0) return lossesDiff;

        const damageDoneDiff = (b.total_damage_done ?? 0) - (a.total_damage_done ?? 0);
        if (damageDoneDiff !== 0) return damageDoneDiff;

        const damageReceivedDiff = (a.total_damage_received ?? 0) - (b.total_damage_received ?? 0);
        if (damageReceivedDiff !== 0) return damageReceivedDiff;

        const spDiff = (b.player?.stark_points ?? 0) - (a.player?.stark_points ?? 0);
        if (spDiff !== 0) return spDiff;

        return new Date(a.joined_at ?? 0).getTime() - new Date(b.joined_at ?? 0).getTime();
      })
      .map((row, index) => ({ ...row, rank: index + 1 }));

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
