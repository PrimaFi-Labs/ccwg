/**
 * Shared event settlement logic.
 *
 * Called by:
 *   1. Admin manual "Complete" button (POST /api/control/events/:id/complete)
 *   2. Auto-settlement in the maintenance cron when ends_at has passed
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  Account,
  CallData,
  RpcProvider,
  ec,
  hash,
  stark,
  validateAndParseAddress,
} from 'starknet';
import { EVENT_SYSTEM_ADDRESS } from '@/src/types/contracts';
import { insertInboxMessages } from '@/src/lib/inbox/service';
import { formatStrk } from '@/src/lib/cartridge/utils';

const DEFAULT_RPC = 'https://api.cartridge.gg/x/starknet/sepolia';

function normalizeEnv(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') return undefined;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted || undefined;
  }
  return trimmed;
}

function getRpcUrl() {
  return (
    normalizeEnv(process.env.NEXT_PUBLIC_CARTRIDGE_RPC) ||
    normalizeEnv(process.env.NEXT_PUBLIC_RPC_URL) ||
    normalizeEnv(process.env.NEXT_PUBLIC_STARKNET_RPC_URL) ||
    normalizeEnv(process.env.RPC_URL) ||
    DEFAULT_RPC
  );
}

function getServerAddress() {
  return normalizeEnv(process.env.SERVER_ACCOUNT_ADDRESS);
}

function getServerPrivateKey() {
  return (
    normalizeEnv(process.env.SERVER_ACCOUNT_PRIVATE_KEY) ||
    normalizeEnv(process.env.SERVER_PRIVATE_KEY)
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function messageContains(error: unknown, needle: string): boolean {
  return toErrorMessage(error).toLowerCase().includes(needle.toLowerCase());
}

/** Singleton-per-settlement Account to avoid nonce races between sequential
 *  on-chain calls (start_event + finalize_event).  starknet.js internally
 *  tracks the pending nonce on the Account instance, so reusing the same
 *  instance ensures finalize_event picks up the nonce incremented by
 *  start_event instead of fetching a stale value from the node.
 */
let _cachedCtx: { privateKey: string; serverAccount: Account } | null = null;

function buildServerAccountContext() {
  if (_cachedCtx) return _cachedCtx;

  const privateKey = getServerPrivateKey();
  const address = getServerAddress();
  const rpcUrl = getRpcUrl();

  if (!privateKey || !address) {
    throw new Error(
      `Missing server account credentials for event settlement ` +
        `(address=${Boolean(address)}, privateKey=${Boolean(privateKey)}, rpcUrl=${Boolean(rpcUrl)})`
    );
  }

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const parsedAddress = validateAndParseAddress(address);
  const serverAccount = new Account({
    provider,
    address: parsedAddress,
    signer: privateKey,
  });

  _cachedCtx = { privateKey, serverAccount };
  return _cachedCtx;
}

/** Reset the cached account so the next call fetches a fresh nonce from the
 *  node.  Call this at the start of each top-level settlement batch. */
function resetServerAccountCache() {
  _cachedCtx = null;
}

async function startEventOnChain(onChainEventId: number): Promise<string> {
  const { serverAccount } = buildServerAccountContext();

  const calldata = CallData.compile({
    event_id: BigInt(onChainEventId),
  });

  const tx = await serverAccount.execute({
    contractAddress: EVENT_SYSTEM_ADDRESS,
    entrypoint: 'start_event',
    calldata,
  });

  await serverAccount.waitForTransaction(tx.transaction_hash, {
    retryInterval: 2000,
    successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
  });

  return tx.transaction_hash;
}

async function finalizeEventOnChain(
  onChainEventId: number,
  rankings: string[]
): Promise<string> {
  const { privateKey, serverAccount } = buildServerAccountContext();

  const messageHash = hash.computePoseidonHashOnElements([
    BigInt(onChainEventId),
    ...rankings.map((wallet) => BigInt(wallet)),
  ]);

  const signature = stark.signatureToHexArray(
    ec.starkCurve.sign(messageHash, privateKey)
  );

  const calldata = CallData.compile({
    event_id: BigInt(onChainEventId),
    rankings,
    signature,
  });

  const tx = await serverAccount.execute({
    contractAddress: EVENT_SYSTEM_ADDRESS,
    entrypoint: 'finalize_event',
    calldata,
  });

  await serverAccount.waitForTransaction(tx.transaction_hash, {
    retryInterval: 2000,
    successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
  });

  return tx.transaction_hash;
}

export interface SettlementResult {
  eventId: number;
  settled: boolean;
  onChainTxHash: string | null;
  error?: string;
  participantCount: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Settle a single event: rank participants, distribute prizes, finalize on-chain.
 */
export async function settleEvent(
  supabase: SupabaseClient,
  eventId: number,
  auditWallet: string = 'system'
): Promise<SettlementResult> {
  const { data: rawEvent, error: eventError } = await supabase
    .from('events')
    .select(
      'event_id, event_name, on_chain_id, status, sp_reward, prize_pool, ' +
        'first_place_percent, second_place_percent, third_place_percent, settled_at'
    )
    .eq('event_id', eventId)
    .single();

  if (eventError || !rawEvent) {
    return {
      eventId,
      settled: false,
      onChainTxHash: null,
      error: 'Event not found',
      participantCount: 0,
    };
  }

  const event = rawEvent as any;

  if (event.settled_at) {
    return { eventId, settled: true, onChainTxHash: null, participantCount: 0 };
  }

  if (event.status === 'Cancelled') {
    return {
      eventId,
      settled: false,
      onChainTxHash: null,
      error: 'Cannot settle a cancelled event',
      participantCount: 0,
    };
  }

  // Atomically claim this event to prevent concurrent settlement.
  // Only one process can set settled_at from NULL to a value.
  const claimTime = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from('events')
    .update({ settled_at: claimTime } as any)
    .eq('event_id', eventId)
    .is('settled_at' as string, null)
    .select('event_id')
    .maybeSingle();

  if (claimError || !claimed) {
    return {
      eventId,
      settled: false,
      onChainTxHash: null,
      error: claimError ? claimError.message : 'Event already being settled by another process',
      participantCount: 0,
    };
  }

  // Reset the Account cache so we start with a fresh nonce from the node.
  resetServerAccountCache();

  let participantCount = 0;
  let onChainFinalizeTxHash: string | null = null;

  try {
    const { data: participants, error: participantsError } = await supabase
      .from('event_participants')
      .select(`
        id,
        player_wallet,
        prize_won,
        war_points,
        total_damage_done,
        total_wins,
        total_damage_received,
        joined_at,
        player:players!event_participants_player_wallet_fkey(stark_points)
      `)
      .eq('event_id', eventId);

    if (participantsError) {
      throw new Error(`Failed to fetch event participants: ${participantsError.message}`);
    }

    const ordered = (participants || []).sort((a: any, b: any) => {
      const pointsDiff = (b.war_points ?? 0) - (a.war_points ?? 0);
      if (pointsDiff !== 0) return pointsDiff;

      const damageDoneDiff = (b.total_damage_done ?? 0) - (a.total_damage_done ?? 0);
      if (damageDoneDiff !== 0) return damageDoneDiff;

      const winsDiff = (b.total_wins ?? 0) - (a.total_wins ?? 0);
      if (winsDiff !== 0) return winsDiff;

      const damageReceivedDiff =
        (a.total_damage_received ?? 0) - (b.total_damage_received ?? 0);
      if (damageReceivedDiff !== 0) return damageReceivedDiff;

      const spDiff = (b.player?.stark_points ?? 0) - (a.player?.stark_points ?? 0);
      if (spDiff !== 0) return spDiff;

      return new Date(a.joined_at ?? 0).getTime() - new Date(b.joined_at ?? 0).getTime();
    });
    participantCount = ordered.length;

    if (event.on_chain_id) {
      const onChainEventId = Number(event.on_chain_id);
      if (!Number.isFinite(onChainEventId) || onChainEventId <= 0) {
        throw new Error(`Invalid on_chain_id on event ${eventId}: ${String(event.on_chain_id)}`);
      }

      const rankings = ordered
        .slice(0, 3)
        .map((row: any) => row.player_wallet)
        .filter((wallet: string | null) => Boolean(wallet));

      if (rankings.length < 3) {
        // On-chain start_event requires >= 3 participants and finalize_event
        // emits all 3 ranking addresses.  With fewer, cancel on-chain instead
        // and settle prizes off-chain only.
        console.warn(
          `[settlement] event ${eventId} has ${rankings.length} participants — ` +
            'skipping on-chain finalize, attempting on-chain cancel'
        );
        try {
          const { cancelEventOnChain } = await import('@/src/lib/starknet/chain');
          await cancelEventOnChain(onChainEventId);
          console.log(`[settlement] event ${eventId} cancelled on-chain`);
        } catch (cancelError) {
          // Already started / completed on-chain, or other error — proceed
          console.warn(
            `[settlement] event ${eventId} on-chain cancel skipped (non-fatal):`,
            toErrorMessage(cancelError)
          );
        }
      } else {
        // The on-chain event may still be Open because syncEventStatuses only
        // updates Supabase.  Proactively call start_event to transition it to
        // InProgress before finalizing.  If it's already InProgress the call
        // will revert with "Event not open" — that's fine.
        try {
          await startEventOnChain(onChainEventId);
          console.log(
            `[settlement] event ${eventId} start_event succeeded (was Open on-chain)`
          );
        } catch (startError) {
          // "Event not open" means it's already InProgress/Completed — expected
          if (!messageContains(startError, 'Event not open')) {
            console.warn(
              `[settlement] event ${eventId} start_event skipped (non-fatal):`,
              toErrorMessage(startError)
            );
          }
        }

        onChainFinalizeTxHash = await finalizeEventOnChain(onChainEventId, rankings);
      }
    }

    for (let i = 0; i < ordered.length; i += 1) {
      const { error } = await supabase
        .from('event_participants')
        .update({ final_rank: i + 1 })
        .eq('id', ordered[i].id);
      if (error) {
        throw new Error(`Failed to update participant rank: ${error.message}`);
      }
    }

    const totalPool = BigInt(event.prize_pool ?? 0);
    const treasuryBps = BigInt(500); // 5%
    const treasuryFee = (totalPool * treasuryBps) / BigInt(10000);
    const netPool = totalPool - treasuryFee;

    const firstPercent = BigInt(event.first_place_percent ?? 6000);
    const secondPercent = BigInt(event.second_place_percent ?? 3000);
    const thirdPercent = BigInt(event.third_place_percent ?? 1000);

    const payouts = [
      (netPool * firstPercent) / BigInt(10000),
      (netPool * secondPercent) / BigInt(10000),
      (netPool * thirdPercent) / BigInt(10000),
    ];

    for (let i = 0; i < Math.min(3, ordered.length); i += 1) {
      const row = ordered[i] as any;
      const wallet = row.player_wallet as string | null;
      if (!wallet) continue;

      const payout = payouts[i] ?? BigInt(0);
      const alreadyAwarded = BigInt(row.prize_won ?? 0);
      const recordedPayout = payout > alreadyAwarded ? payout : alreadyAwarded;
      const delta = recordedPayout - alreadyAwarded;

      const { error: participantPayoutError } = await supabase
        .from('event_participants')
        .update({ prize_won: recordedPayout.toString() })
        .eq('id', row.id);
      if (participantPayoutError) {
        throw new Error(`Failed to record participant payout: ${participantPayoutError.message}`);
      }

      if (delta > BigInt(0)) {
        const { data: player, error: playerFetchError } = await supabase
          .from('players')
          .select('strk_balance')
          .eq('wallet_address', wallet)
          .maybeSingle();
        if (playerFetchError) {
          throw new Error(`Failed to fetch player balance: ${playerFetchError.message}`);
        }

        const currentBalance = BigInt(player?.strk_balance ?? 0);
        const nextBalance = currentBalance + delta;

        const { error: balanceUpdateError } = await supabase
          .from('players')
          .update({ strk_balance: nextBalance.toString() })
          .eq('wallet_address', wallet);
        if (balanceUpdateError) {
          throw new Error(`Failed to update player balance: ${balanceUpdateError.message}`);
        }
      }
    }

    // ── Auto-disburse: transfer STRK from on-chain internal balance to
    //    winner wallets.  Only when finalize_event actually credited balances. ──
    if (onChainFinalizeTxHash) {
      const { disburseOnChain } = await import('@/src/lib/starknet/chain');
      for (let i = 0; i < Math.min(3, ordered.length); i += 1) {
        const wallet = (ordered[i] as any).player_wallet as string | null;
        if (!wallet) continue;
        const payout = payouts[i] ?? BigInt(0);
        if (payout <= BigInt(0)) continue;

        try {
          await disburseOnChain(wallet, payout);
          console.log(
            `[settlement] event ${eventId} disbursed ${formatStrk(payout)} STRK to ${wallet}`
          );
        } catch (disburseError) {
          // Non-fatal: the player can still withdraw manually via the UI in
          // the future if the auto-disburse fails.
          console.warn(
            `[settlement] event ${eventId} auto-disburse to ${wallet} failed (non-fatal):`,
            toErrorMessage(disburseError)
          );
        }
      }
    }

    const spReward = event.sp_reward ?? 0;
    const placementLabel = ['1st', '2nd', '3rd'];
    const eventName = event.event_name || `Event #${eventId}`;
    await insertInboxMessages(
      supabase,
      ordered
        .map((row, index) => {
          const wallet = row.player_wallet;
          if (!wallet) return null;

          const payout = index < 3 ? (payouts[index] ?? BigInt(0)) : BigInt(0);
          const place = placementLabel[index] ?? `${index + 1}th`;

          return {
            player_wallet: wallet,
            subject: `Event Result: ${eventName}`,
            body:
              `Event "${eventName}" has ended.\n` +
              `Final position: ${place}.\n` +
              `Payout: ${formatStrk(payout)} STRK` +
              (onChainFinalizeTxHash && payout > BigInt(0)
                ? ' (sent to your wallet).'
                : '.') +
              (index === 0 && spReward > 0 ? `\nSP Award: ${spReward} SP.` : ''),
            category: 'system' as const,
            notification_key: `event_result:${eventId}:${wallet.toLowerCase()}`,
          };
        })
        .filter((msg): msg is NonNullable<typeof msg> => Boolean(msg))
    );

    const winners = ordered.slice(0, 1).filter((row: any) => row.player_wallet);

    if (spReward > 0 && winners.length > 0) {
      for (const winner of winners) {
        const w = winner as any;
        const wallet = w.player_wallet;
        if (!wallet) continue;

        const { data: player, error: spFetchError } = await supabase
          .from('players')
          .select('stark_points')
          .eq('wallet_address', wallet)
          .maybeSingle();
        if (spFetchError) {
          throw new Error(`Failed to fetch player SP: ${spFetchError.message}`);
        }

        if (!player) continue;

        const current = player.stark_points ?? 0;
        const next = Math.max(0, current + spReward);
        if (next !== current) {
          const { error: spUpdateError } = await supabase
            .from('players')
            .update({ stark_points: next })
            .eq('wallet_address', wallet);
          if (spUpdateError) {
            throw new Error(`Failed to update player SP: ${spUpdateError.message}`);
          }
        }
      }
    }

    const now = new Date().toISOString();
    const { data: updated, error: eventUpdateError } = await supabase
      .from('events')
      .update({
        status: 'Completed' as any,
        ends_at: now,
        settled_at: now,
      } as any)
      .eq('event_id', eventId)
      .select()
      .single();
    if (eventUpdateError) {
      throw new Error(`Failed to mark event settled: ${eventUpdateError.message}`);
    }

    const { error: auditError } = await supabase.from('audit_logs').insert({
      admin_wallet: auditWallet,
      action: 'complete_event',
      table_name: 'events',
      record_id: eventId.toString(),
      after_data: {
        ...(updated ?? {}),
        treasury_fee: treasuryFee.toString(),
        distributed_pool: netPool.toString(),
        on_chain_finalize_tx: onChainFinalizeTxHash,
      },
    });
    if (auditError) {
      console.warn(
        `[settlement] event ${eventId} audit log insert failed (non-blocking):`,
        auditError.message
      );
    }

    return {
      eventId,
      settled: true,
      onChainTxHash: onChainFinalizeTxHash,
      participantCount: ordered.length,
    };
  } catch (err) {
    const msg = toErrorMessage(err);
    console.error(`[settlement] event ${eventId} failed:`, msg);

    // Release the claim so the next maintenance cycle can retry.
    await supabase
      .from('events')
      .update({ settled_at: null } as any)
      .eq('event_id', eventId);

    return {
      eventId,
      settled: false,
      onChainTxHash: onChainFinalizeTxHash,
      error: msg,
      participantCount,
    };
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Find all events whose ends_at has passed but haven't been settled,
 * and settle them automatically.
 */
export async function autoSettleEndedEvents(
  supabase: SupabaseClient,
  nowIso: string = new Date().toISOString()
): Promise<SettlementResult[]> {
  const { data: unsettled } = await supabase
    .from('events')
    .select('event_id, settled_at')
    .in('status', ['Completed', 'InProgress', 'Open'])
    .is('settled_at' as string, null)
    .not('ends_at', 'is', null)
    .lte('ends_at', nowIso);

  if (!unsettled || unsettled.length === 0) return [];

  const results: SettlementResult[] = [];

  for (const row of unsettled) {
    try {
      const result = await settleEvent(supabase, row.event_id, 'system');
      results.push(result);
      console.log(
        `[auto-settlement] event ${row.event_id}: settled=${result.settled}` +
          (result.error ? ` error=${result.error}` : '')
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[auto-settlement] event ${row.event_id} failed:`, msg);
      results.push({
        eventId: row.event_id,
        settled: false,
        onChainTxHash: null,
        error: msg,
        participantCount: 0,
      });
    }
  }

  return results;
}
