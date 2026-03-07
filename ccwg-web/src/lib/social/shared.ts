export type ChallengeSwapRule = 'Fun' | 'Strict';

export const FRIEND_REQUEST_DAILY_LIMIT = 3;
export const PRESENCE_WINDOW_MS = 2 * 60 * 1000;
export const CHALLENGE_EXPIRY_MS = 45 * 1000;
/** Max time (ms) a challenge match can stay in WaitingForOpponent after
 *  the invite is accepted before it's considered abandoned. */
export const CHALLENGE_MATCH_STALE_MS = 3 * 60 * 1000;

export function normalizeFriendPair(a: string, b: string) {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left < right
    ? { playerLow: left, playerHigh: right }
    : { playerLow: right, playerHigh: left };
}

export function isPlayerOnline(lastSeen: string | null | undefined) {
  if (!lastSeen) return false;
  const seenAt = new Date(lastSeen).getTime();
  if (!Number.isFinite(seenAt)) return false;
  return Date.now() - seenAt <= PRESENCE_WINDOW_MS;
}

export function getChallengeSwapLimit(totalRounds: number, swapRule: ChallengeSwapRule) {
  if (swapRule === 'Fun') return 999;
  if (totalRounds >= 10) return 4;
  return 2;
}

export async function touchPlayerPresence(
  supabase: any,
  wallet: string,
  currentPage: string | null = null
) {
  await supabase.from('player_presence').upsert({
    wallet_address: wallet.toLowerCase(),
    last_seen: new Date().toISOString(),
    current_page: currentPage,
  });
}

export async function expireStaleChallenges(supabase: any) {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const { data: pendingRows } = await supabase
    .from('challenge_invites')
    .select('challenge_id, match_id, expires_at, created_at')
    .eq('status', 'Pending');

  if (!pendingRows || pendingRows.length === 0) {
    // Even if no pending rows, still check for stale accepted challenges below
  } else {

  const stale = pendingRows.filter((row: {
    challenge_id: number;
    match_id: number | null;
    expires_at: string | null;
    created_at: string | null;
  }) => {
    const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : Number.POSITIVE_INFINITY;
    const createdAtMs = row.created_at ? new Date(row.created_at).getTime() : Number.POSITIVE_INFINITY;
    const cappedExpiryMs = createdAtMs + CHALLENGE_EXPIRY_MS;
    const effectiveExpiryMs = Math.min(expiresAtMs, cappedExpiryMs);
    return Number.isFinite(effectiveExpiryMs) && nowMs > effectiveExpiryMs;
  });

  if (stale.length > 0) {

  const ids = stale.map((row: { challenge_id: number }) => row.challenge_id);
  const matchIds = stale
    .map((row: { match_id: number | null }) => row.match_id)
    .filter((value: number | null): value is number => Number.isFinite(value));

  await supabase
    .from('challenge_invites')
    .update({
      status: 'Expired',
      responded_at: nowIso,
    })
    .in('challenge_id', ids);

  if (matchIds.length > 0) {
    await supabase
      .from('matches')
      .update({
        status: 'Cancelled',
        ended_at: nowIso,
      })
      .in('match_id', matchIds)
      .eq('status', 'WaitingForOpponent');
  }

  } // end if stale.length > 0
  } // end if pendingRows

  // Also clean up accepted challenges whose matches never started (stale > 3 min)
  const staleCutoffMs = nowMs - CHALLENGE_MATCH_STALE_MS;
  const { data: acceptedStaleRows } = await supabase
    .from('challenge_invites')
    .select('challenge_id, match_id, responded_at, created_at')
    .eq('status', 'Accepted');

  if (acceptedStaleRows && acceptedStaleRows.length > 0) {
    const staleAccepted = acceptedStaleRows.filter((row: {
      challenge_id: number;
      match_id: number | null;
      responded_at: string | null;
      created_at: string | null;
    }) => {
      const respondedAtMs = row.responded_at ? new Date(row.responded_at).getTime() : 0;
      const createdAtMs = row.created_at ? new Date(row.created_at).getTime() : 0;
      const acceptedAtMs = respondedAtMs || createdAtMs;
      return acceptedAtMs > 0 && acceptedAtMs < staleCutoffMs;
    });

    if (staleAccepted.length > 0) {
      const staleAcceptedIds = staleAccepted.map((row: { challenge_id: number }) => row.challenge_id);
      const staleAcceptedMatchIds = staleAccepted
        .map((row: { match_id: number | null }) => row.match_id)
        .filter((value: number | null): value is number => Number.isFinite(value));

      await supabase
        .from('challenge_invites')
        .update({ status: 'Expired', responded_at: nowIso })
        .in('challenge_id', staleAcceptedIds);

      if (staleAcceptedMatchIds.length > 0) {
        await supabase
          .from('matches')
          .update({ status: 'Cancelled', ended_at: nowIso })
          .in('match_id', staleAcceptedMatchIds)
          .eq('status', 'WaitingForOpponent');
      }
    }
  }
}

/** Returns the blocking match_id (number) if the player is busy, or false if free. */
export async function isPlayerBusyInAnotherMatch(
  supabase: any,
  wallet: string,
  excludeMatchId: number | null = null
): Promise<number | false> {
  const normalized = wallet.toLowerCase();
  const { data: playerRows } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('player_wallet', normalized);

  const matchIds = (playerRows || [])
    .map((row: { match_id: number | null }) => row.match_id)
    .filter((value: number | null): value is number => Number.isFinite(value))
    .filter((value: number) => excludeMatchId == null || value !== excludeMatchId);

  if (matchIds.length === 0) return false;

  const { data: matches } = await supabase
    .from('matches')
    .select('match_id, mode, status')
    .in('match_id', matchIds)
    .in('status', ['WaitingForOpponent', 'InProgress', 'PausedOracle']);

  if (!matches || matches.length === 0) return false;

  const nonChallengeMatch = matches.find((row: { mode?: string | null }) => row.mode !== 'Challenge');
  if (nonChallengeMatch) return nonChallengeMatch.match_id as number;

  const challengeMatchIds = matches
    .map((row: { match_id: number | null; mode?: string | null }) =>
      row.mode === 'Challenge' ? row.match_id : null
    )
    .filter((value: number | null): value is number => Number.isFinite(value));

  if (challengeMatchIds.length === 0) return false;

  const { data: invites } = await supabase
    .from('challenge_invites')
    .select('match_id, status, expires_at, created_at, responded_at')
    .in('match_id', challengeMatchIds);

  const inviteByMatchId = new Map<number, { status: string; expires_at: string | null; created_at: string | null; responded_at: string | null }>();
  for (const row of invites || []) {
    if (!Number.isFinite(row.match_id)) continue;
    inviteByMatchId.set(row.match_id, {
      status: row.status,
      expires_at: row.expires_at,
      created_at: row.created_at,
      responded_at: row.responded_at,
    });
  }

  const matchStatusById = new Map<number, string>();
  for (const row of matches || []) {
    if (Number.isFinite(row.match_id)) matchStatusById.set(row.match_id, row.status);
  }

  const nowMs = Date.now();
  const staleMatchIds: number[] = [];

  for (const matchId of challengeMatchIds) {
    const invite = inviteByMatchId.get(matchId);
    if (!invite) continue;

    if (invite.status === 'Accepted') {
      const matchStatus = matchStatusById.get(matchId);
      // If the match is InProgress it's genuinely active — player is busy
      if (matchStatus === 'InProgress' || matchStatus === 'PausedOracle') return matchId;

      // WaitingForOpponent + Accepted invite: only busy if recently accepted
      const respondedAtMs = invite.responded_at ? new Date(invite.responded_at).getTime() : 0;
      const createdAtMs = invite.created_at ? new Date(invite.created_at).getTime() : 0;
      const acceptedAtMs = respondedAtMs || createdAtMs;
      if (acceptedAtMs > 0 && nowMs - acceptedAtMs > CHALLENGE_MATCH_STALE_MS) {
        // Stale: accepted too long ago, match never progressed — mark for cleanup
        staleMatchIds.push(matchId);
        continue;
      }
      return matchId;
    }

    if (invite.status !== 'Pending') continue;

    const expiresAtMs = invite.expires_at ? new Date(invite.expires_at).getTime() : Number.POSITIVE_INFINITY;
    const createdAtMs = invite.created_at ? new Date(invite.created_at).getTime() : Number.POSITIVE_INFINITY;
    const cappedExpiryMs = createdAtMs + CHALLENGE_EXPIRY_MS;
    const effectiveExpiryMs = Math.min(expiresAtMs, cappedExpiryMs);
    if (Number.isFinite(effectiveExpiryMs) && nowMs <= effectiveExpiryMs) return matchId;
  }

  // Asynchronously cancel stale challenge matches that never started
  if (staleMatchIds.length > 0) {
    const staleNowIso = new Date().toISOString();
    void supabase
      .from('matches')
      .update({ status: 'Cancelled', ended_at: staleNowIso })
      .in('match_id', staleMatchIds)
      .eq('status', 'WaitingForOpponent')
      .then(() =>
        supabase
          .from('challenge_invites')
          .update({ status: 'Expired', responded_at: staleNowIso })
          .in('match_id', staleMatchIds)
          .eq('status', 'Accepted')
      );
  }

  return false;
}
