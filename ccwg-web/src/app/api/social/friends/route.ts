import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';
import {
  FRIEND_REQUEST_DAILY_LIMIT,
  normalizeFriendPair,
  touchPlayerPresence,
} from '@/src/lib/social/shared';

type FriendAction = 'request' | 'accept' | 'decline' | 'cancel' | 'remove';

export async function POST(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const body = await request.json().catch(() => ({}));
    const action = body?.action as FriendAction;

    const supabase = createServiceClient();
    await ensurePlayerExists(wallet);
    await touchPlayerPresence(supabase as any, wallet, '/profile');

    if (action === 'request') {
      const targetWallet =
        typeof body?.target_wallet === 'string' ? body.target_wallet.toLowerCase().trim() : '';

      if (!targetWallet || targetWallet === wallet) {
        return NextResponse.json({ error: 'Invalid friend target.' }, { status: 400 });
      }

      const { data: targetPlayer } = await (supabase as any)
        .from('players')
        .select('wallet_address')
        .eq('wallet_address', targetWallet)
        .maybeSingle();

      if (!targetPlayer) {
        return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
      }

      const { playerLow, playerHigh } = normalizeFriendPair(wallet, targetWallet);
      const { data: existingFriendship } = await (supabase as any)
        .from('player_friendships')
        .select('friendship_id')
        .eq('player_low', playerLow)
        .eq('player_high', playerHigh)
        .maybeSingle();

      if (existingFriendship) {
        return NextResponse.json({ error: 'You are already friends.' }, { status: 409 });
      }

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { data: sentToday } = await (supabase as any)
        .from('friend_requests')
        .select('request_id')
        .eq('requester_wallet', wallet)
        .gte('created_at', todayStart.toISOString());

      if ((sentToday || []).length >= FRIEND_REQUEST_DAILY_LIMIT) {
        return NextResponse.json(
          { error: `Daily friend request limit reached (${FRIEND_REQUEST_DAILY_LIMIT}/day).` },
          { status: 429 }
        );
      }

      const { data: existingPending } = await (supabase as any)
        .from('friend_requests')
        .select('request_id, requester_wallet, addressee_wallet')
        .eq('status', 'Pending')
        .or(
          `and(requester_wallet.eq.${wallet},addressee_wallet.eq.${targetWallet}),and(requester_wallet.eq.${targetWallet},addressee_wallet.eq.${wallet})`
        );

      if ((existingPending || []).length > 0) {
        const reverse = existingPending.some(
          (row: { requester_wallet: string }) => row.requester_wallet === targetWallet
        );
        return NextResponse.json(
          {
            error: reverse
              ? 'This player already sent you a friend request.'
              : 'A friend request is already pending.',
          },
          { status: 409 }
        );
      }

      const { error } = await (supabase as any).from('friend_requests').insert({
        requester_wallet: wallet,
        addressee_wallet: targetWallet,
        status: 'Pending',
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'accept' || action === 'decline' || action === 'cancel') {
      const requestId = Number(body?.request_id);
      if (!Number.isFinite(requestId) || requestId <= 0) {
        return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });
      }

      const { data: friendRequest } = await (supabase as any)
        .from('friend_requests')
        .select('request_id, requester_wallet, addressee_wallet, status')
        .eq('request_id', requestId)
        .maybeSingle();

      if (!friendRequest) {
        return NextResponse.json({ error: 'Friend request not found.' }, { status: 404 });
      }

      if (friendRequest.status !== 'Pending') {
        return NextResponse.json({ error: 'This friend request is no longer pending.' }, { status: 409 });
      }

      const isRequester = friendRequest.requester_wallet === wallet;
      const isAddressee = friendRequest.addressee_wallet === wallet;
      if (!isRequester && !isAddressee) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      if (action === 'accept' && !isAddressee) {
        return NextResponse.json({ error: 'Only the recipient can accept a friend request.' }, { status: 403 });
      }

      if (action === 'decline' && !isAddressee) {
        return NextResponse.json({ error: 'Only the recipient can decline a friend request.' }, { status: 403 });
      }

      if (action === 'cancel' && !isRequester) {
        return NextResponse.json({ error: 'Only the sender can cancel a friend request.' }, { status: 403 });
      }

      const nowIso = new Date().toISOString();

      if (action === 'accept') {
        const { playerLow, playerHigh } = normalizeFriendPair(
          friendRequest.requester_wallet,
          friendRequest.addressee_wallet
        );

        await (supabase as any).from('player_friendships').upsert({
          player_low: playerLow,
          player_high: playerHigh,
          created_at: nowIso,
        });

        await (supabase as any)
          .from('friend_requests')
          .update({ status: 'Accepted', responded_at: nowIso })
          .eq('request_id', requestId);

        return NextResponse.json({ ok: true });
      }

      await (supabase as any)
        .from('friend_requests')
        .update({
          status: action === 'decline' ? 'Declined' : 'Cancelled',
          responded_at: nowIso,
        })
        .eq('request_id', requestId);

      return NextResponse.json({ ok: true });
    }

    if (action === 'remove') {
      const targetWallet =
        typeof body?.target_wallet === 'string' ? body.target_wallet.toLowerCase().trim() : '';
      if (!targetWallet || targetWallet === wallet) {
        return NextResponse.json({ error: 'Invalid friend target.' }, { status: 400 });
      }

      const { playerLow, playerHigh } = normalizeFriendPair(wallet, targetWallet);

      await (supabase as any)
        .from('player_friendships')
        .delete()
        .eq('player_low', playerLow)
        .eq('player_high', playerHigh);

      await (supabase as any)
        .from('friend_requests')
        .update({ status: 'Cancelled', responded_at: new Date().toISOString() })
        .eq('status', 'Pending')
        .or(
          `and(requester_wallet.eq.${wallet},addressee_wallet.eq.${targetWallet}),and(requester_wallet.eq.${targetWallet},addressee_wallet.eq.${wallet})`
        );

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported friend action.' }, { status: 400 });
  } catch (error) {
    console.error('Friends action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
