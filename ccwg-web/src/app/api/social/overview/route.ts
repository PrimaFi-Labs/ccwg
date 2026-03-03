import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';
import {
  FRIEND_REQUEST_DAILY_LIMIT,
  expireStaleChallenges,
  isPlayerOnline,
  touchPlayerPresence,
} from '@/src/lib/social/shared';

type PlayerLite = {
  wallet_address: string;
  username: string | null;
};

type PresenceLite = {
  wallet_address: string;
  last_seen: string;
};

export async function GET(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const supabase = createServiceClient();
    await ensurePlayerExists(wallet);
    await touchPlayerPresence(supabase as any, wallet, '/profile');
    await expireStaleChallenges(supabase as any);

    const { data: friendshipRows } = await (supabase as any)
      .from('player_friendships')
      .select('player_low, player_high')
      .or(`player_low.eq.${wallet},player_high.eq.${wallet}`);

    const friendWallets = (friendshipRows || []).map((row: { player_low: string; player_high: string }) =>
      row.player_low === wallet ? row.player_high : row.player_low
    );

    const friendRequestsPromise = (supabase as any)
      .from('friend_requests')
      .select('request_id, requester_wallet, addressee_wallet, created_at')
      .eq('status', 'Pending')
      .or(`requester_wallet.eq.${wallet},addressee_wallet.eq.${wallet}`)
      .order('created_at', { ascending: false });

    const challengesPromise = (supabase as any)
      .from('challenge_invites')
      .select('challenge_id, inviter_wallet, invitee_wallet, match_id, total_rounds, swap_rule, status, expires_at, created_at')
      .in('status', ['Pending', 'Accepted'])
      .or(`inviter_wallet.eq.${wallet},invitee_wallet.eq.${wallet}`)
      .order('created_at', { ascending: false });

    const relatedWallets = new Set<string>(friendWallets);
    const [{ data: friendRequests }, { data: challenges }] = await Promise.all([
      friendRequestsPromise,
      challengesPromise,
    ]);

    for (const requestRow of friendRequests || []) {
      relatedWallets.add(
        requestRow.requester_wallet === wallet ? requestRow.addressee_wallet : requestRow.requester_wallet
      );
    }

    for (const challenge of challenges || []) {
      relatedWallets.add(
        challenge.inviter_wallet === wallet ? challenge.invitee_wallet : challenge.inviter_wallet
      );
    }

    const walletList = Array.from(relatedWallets);

    let playerMap = new Map<string, PlayerLite>();
    let presenceMap = new Map<string, PresenceLite>();

    if (walletList.length > 0) {
      const [{ data: players }, { data: presenceRows }] = await Promise.all([
        (supabase as any)
          .from('players')
          .select('wallet_address, username')
          .in('wallet_address', walletList),
        (supabase as any)
          .from('player_presence')
          .select('wallet_address, last_seen')
          .in('wallet_address', walletList),
      ]);

      playerMap = new Map(
        (players || []).map((row: PlayerLite) => [row.wallet_address.toLowerCase(), row])
      );
      presenceMap = new Map(
        (presenceRows || []).map((row: PresenceLite) => [row.wallet_address.toLowerCase(), row])
      );
    }

    const friends = friendWallets.map((friendWallet: string) => {
      const key = friendWallet.toLowerCase();
      const player = playerMap.get(key);
      const presence = presenceMap.get(key);
      return {
        wallet_address: key,
        username: player?.username ?? null,
        online: isPlayerOnline(presence?.last_seen),
        last_seen: presence?.last_seen ?? null,
      };
    });

    const friendRequestsPayload = (friendRequests || []).map((row: {
      request_id: number;
      requester_wallet: string;
      addressee_wallet: string;
      created_at: string;
    }) => {
      const incoming = row.addressee_wallet === wallet;
      const otherWallet = incoming ? row.requester_wallet : row.addressee_wallet;
      const otherPlayer = playerMap.get(otherWallet.toLowerCase());
      return {
        request_id: row.request_id,
        direction: incoming ? 'incoming' : 'outgoing',
        wallet_address: otherWallet.toLowerCase(),
        username: otherPlayer?.username ?? null,
        created_at: row.created_at,
      };
    });

    const challengePayload = (challenges || []).map((row: {
      challenge_id: number;
      inviter_wallet: string;
      invitee_wallet: string;
      match_id: number;
      total_rounds: number;
      swap_rule: string;
      status: string;
      expires_at: string;
      created_at: string;
    }) => {
      const incoming = row.invitee_wallet === wallet;
      const otherWallet = incoming ? row.inviter_wallet : row.invitee_wallet;
      const otherPlayer = playerMap.get(otherWallet.toLowerCase());
      const otherPresence = presenceMap.get(otherWallet.toLowerCase());
      return {
        challenge_id: row.challenge_id,
        direction: incoming ? 'incoming' : 'outgoing',
        wallet_address: otherWallet.toLowerCase(),
        username: otherPlayer?.username ?? null,
        online: isPlayerOnline(otherPresence?.last_seen),
        match_id: row.match_id,
        total_rounds: row.total_rounds,
        swap_rule: row.swap_rule,
        status: row.status,
        expires_at: row.expires_at,
        created_at: row.created_at,
      };
    });

    return NextResponse.json({
      friends,
      friend_requests: friendRequestsPayload,
      challenges: challengePayload,
      limits: {
        friend_requests_per_day: FRIEND_REQUEST_DAILY_LIMIT,
      },
    });
  } catch (error) {
    console.error('Social overview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
