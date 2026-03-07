import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';
import {
  CHALLENGE_EXPIRY_MS,
  ChallengeSwapRule,
  expireStaleChallenges,
  isPlayerBusyInAnotherMatch,
  isPlayerOnline,
  normalizeFriendPair,
  touchPlayerPresence,
} from '@/src/lib/social/shared';

type ChallengeAction = 'send' | 'accept' | 'decline' | 'cancel';

function isValidDeck(deck: unknown): deck is [number, number, number] {
  return (
    Array.isArray(deck) &&
    deck.length === 3 &&
    deck.every((value) => Number.isInteger(value) && Number(value) > 0)
  );
}

function isValidSwapRule(value: unknown): value is ChallengeSwapRule {
  return value === 'Fun' || value === 'Strict';
}

function isValidRounds(value: unknown): value is 3 | 5 | 10 {
  return value === 3 || value === 5 || value === 10;
}

export async function POST(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const body = await request.json().catch(() => ({}));
    const action = body?.action as ChallengeAction;

    const supabase = createServiceClient();
    await ensurePlayerExists(wallet);
    await touchPlayerPresence(supabase as any, wallet, '/profile');
    await expireStaleChallenges(supabase as any);

    if (action === 'send') {
      const targetWallet =
        typeof body?.target_wallet === 'string' ? body.target_wallet.toLowerCase().trim() : '';
      const totalRounds = Number(body?.total_rounds);
      const swapRule = body?.swap_rule;
      const deck = body?.deck;

      if (!targetWallet || targetWallet === wallet) {
        return NextResponse.json({ error: 'Invalid challenge target.' }, { status: 400 });
      }

      if (!isValidRounds(totalRounds) || !isValidSwapRule(swapRule) || !isValidDeck(deck)) {
        return NextResponse.json({ error: 'Invalid challenge configuration.' }, { status: 400 });
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
      const { data: friendship } = await (supabase as any)
        .from('player_friendships')
        .select('friendship_id')
        .eq('player_low', playerLow)
        .eq('player_high', playerHigh)
        .maybeSingle();

      if (!friendship) {
        return NextResponse.json({ error: 'You can only challenge accepted friends.' }, { status: 403 });
      }

      const { data: targetPresence } = await (supabase as any)
        .from('player_presence')
        .select('last_seen')
        .eq('wallet_address', targetWallet)
        .maybeSingle();

      if (!isPlayerOnline(targetPresence?.last_seen)) {
        return NextResponse.json({ error: 'That friend is offline right now.' }, { status: 409 });
      }

      const nowIso = new Date().toISOString();
      const activeExpiryIso = new Date(Date.now() + CHALLENGE_EXPIRY_MS).toISOString();

      const { data: pendingChallenge } = await (supabase as any)
        .from('challenge_invites')
        .select('challenge_id, expires_at')
        .eq('status', 'Pending')
        .gt('expires_at', nowIso)
        .or(
          `and(inviter_wallet.eq.${wallet},invitee_wallet.eq.${targetWallet}),and(inviter_wallet.eq.${targetWallet},invitee_wallet.eq.${wallet})`
        )
        .maybeSingle();

      if (pendingChallenge) {
        return NextResponse.json(
          {
            error: 'There is already a live challenge between you two.',
            expires_at: pendingChallenge.expires_at,
          },
          { status: 409 }
        );
      }

      const { data: myPendingChallenge } = await (supabase as any)
        .from('challenge_invites')
        .select('challenge_id, invitee_wallet, expires_at')
        .eq('inviter_wallet', wallet)
        .eq('status', 'Pending')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (myPendingChallenge) {
        return NextResponse.json(
          {
            error: 'You already have a pending challenge waiting for response.',
            expires_at: myPendingChallenge.expires_at,
          },
          { status: 409 }
        );
      }

      const senderBlockingMatchId = await isPlayerBusyInAnotherMatch(supabase as any, wallet);
      if (senderBlockingMatchId !== false) {
        return NextResponse.json(
          { error: 'Finish your active match before sending a challenge.', blocking_match_id: senderBlockingMatchId },
          { status: 409 }
        );
      }

      if ((await isPlayerBusyInAnotherMatch(supabase as any, targetWallet)) !== false) {
        return NextResponse.json({ error: 'That friend is already in another match.' }, { status: 409 });
      }

      const { data: ownedCards } = await (supabase as any)
        .from('player_cards')
        .select('id')
        .eq('owner_wallet', wallet)
        .in('id', deck);

      if (!ownedCards || ownedCards.length !== 3) {
        return NextResponse.json({ error: 'Invalid deck. Choose 3 of your own cards.' }, { status: 400 });
      }

      const { data: match, error: matchError } = await (supabase as any)
        .from('matches')
        .insert({
          player_1: wallet,
          player_2: targetWallet,
          mode: 'Challenge',
          status: 'WaitingForOpponent',
          total_stake: '0',
          current_round: 0,
          total_rounds: totalRounds,
          p1_rounds_won: 0,
          p2_rounds_won: 0,
        })
        .select()
        .single();

      if (matchError || !match) {
        return NextResponse.json({ error: matchError?.message || 'Failed to create challenge match.' }, { status: 500 });
      }

      const { error: matchPlayerError } = await (supabase as any).from('match_players').insert({
        match_id: match.match_id,
        player_wallet: wallet,
        card_1_id: deck[0],
        card_2_id: deck[1],
        card_3_id: deck[2],
        active_card_id: deck[0],
        swaps_used: 0,
        charge_used: false,
      });

      if (matchPlayerError) {
        await (supabase as any).from('matches').delete().eq('match_id', match.match_id);
        return NextResponse.json({ error: matchPlayerError.message }, { status: 500 });
      }

      const { error: inviteError } = await (supabase as any).from('challenge_invites').insert({
        inviter_wallet: wallet,
        invitee_wallet: targetWallet,
        match_id: match.match_id,
        total_rounds: totalRounds,
        swap_rule: swapRule,
        status: 'Pending',
        expires_at: activeExpiryIso,
      });

      if (inviteError) {
        await (supabase as any).from('match_players').delete().eq('match_id', match.match_id);
        await (supabase as any).from('matches').delete().eq('match_id', match.match_id);
        return NextResponse.json({ error: inviteError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, match_id: match.match_id });
    }

    if (action === 'accept' || action === 'decline' || action === 'cancel') {
      const challengeId = Number(body?.challenge_id);
      if (!Number.isFinite(challengeId) || challengeId <= 0) {
        return NextResponse.json({ error: 'Invalid challenge id.' }, { status: 400 });
      }

      const { data: challenge } = await (supabase as any)
        .from('challenge_invites')
        .select('challenge_id, inviter_wallet, invitee_wallet, match_id, status, expires_at')
        .eq('challenge_id', challengeId)
        .maybeSingle();

      if (!challenge) {
        return NextResponse.json({ error: 'Challenge not found.' }, { status: 404 });
      }

      if (challenge.status !== 'Pending') {
        return NextResponse.json({ error: 'This challenge is no longer pending.' }, { status: 409 });
      }

      if (new Date(challenge.expires_at).getTime() <= Date.now()) {
        await expireStaleChallenges(supabase as any);
        return NextResponse.json({ error: 'This challenge expired.' }, { status: 409 });
      }

      const isInviter = challenge.inviter_wallet === wallet;
      const isInvitee = challenge.invitee_wallet === wallet;
      if (!isInviter && !isInvitee) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      if (action === 'accept' && !isInvitee) {
        return NextResponse.json({ error: 'Only the invited friend can accept.' }, { status: 403 });
      }

      if (action === 'decline' && !isInvitee) {
        return NextResponse.json({ error: 'Only the invited friend can decline.' }, { status: 403 });
      }

      if (action === 'cancel' && !isInviter) {
        return NextResponse.json({ error: 'Only the sender can cancel this challenge.' }, { status: 403 });
      }

      const nowIso = new Date().toISOString();

      if (action === 'accept') {
        const { playerLow, playerHigh } = normalizeFriendPair(
          challenge.inviter_wallet,
          challenge.invitee_wallet
        );

        const { data: friendship } = await (supabase as any)
          .from('player_friendships')
          .select('friendship_id')
          .eq('player_low', playerLow)
          .eq('player_high', playerHigh)
          .maybeSingle();

        if (!friendship) {
          return NextResponse.json({ error: 'You are no longer friends with this player.' }, { status: 409 });
        }

        const { data: inviterPresence } = await (supabase as any)
          .from('player_presence')
          .select('last_seen')
          .eq('wallet_address', challenge.inviter_wallet)
          .maybeSingle();

        if (!isPlayerOnline(inviterPresence?.last_seen)) {
          return NextResponse.json({ error: 'Your friend is offline now.' }, { status: 409 });
        }

        const accepterBlockingMatchId = await isPlayerBusyInAnotherMatch(supabase as any, wallet, challenge.match_id);
        if (accepterBlockingMatchId !== false) {
          return NextResponse.json(
            { error: 'Finish your active match before accepting this challenge.', blocking_match_id: accepterBlockingMatchId },
            { status: 409 }
          );
        }

        if (
          (await isPlayerBusyInAnotherMatch(supabase as any, challenge.inviter_wallet, challenge.match_id)) !== false
        ) {
          return NextResponse.json({ error: 'Your friend is already in another match.' }, { status: 409 });
        }

        const { count: cardCount } = await (supabase as any)
          .from('player_cards')
          .select('*', { count: 'exact', head: true })
          .eq('owner_wallet', wallet);

        if ((cardCount ?? 0) < 3) {
          return NextResponse.json({ error: 'You need at least 3 cards to accept this challenge.' }, { status: 409 });
        }

        await (supabase as any)
          .from('challenge_invites')
          .update({ status: 'Accepted', responded_at: nowIso })
          .eq('challenge_id', challengeId);

        return NextResponse.json({ ok: true, match_id: challenge.match_id });
      }

      await (supabase as any)
        .from('challenge_invites')
        .update({
          status: action === 'decline' ? 'Declined' : 'Cancelled',
          responded_at: nowIso,
        })
        .eq('challenge_id', challengeId);

      await (supabase as any)
        .from('matches')
        .update({
          status: 'Cancelled',
          ended_at: nowIso,
        })
        .eq('match_id', challenge.match_id)
        .eq('status', 'WaitingForOpponent');

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported challenge action.' }, { status: 400 });
  } catch (error) {
    console.error('Challenge action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
