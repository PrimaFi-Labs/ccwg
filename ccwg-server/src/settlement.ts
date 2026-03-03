// ccwg-web/server/settlement.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { Account, CallData, RpcProvider, validateAndParseAddress, ec, num, hash, cairo } from 'starknet';
import { ESCROW_SYSTEM_ADDRESS, normalizeEnv, getRpcUrl } from '@ccwg/shared';


function computeSettlementHash(
  matchId: number,
  winner: string,
  p1RoundsWon: number,
  p2RoundsWon: number,
  transcriptHash: string
): bigint {
  const elements: bigint[] = [
    BigInt(matchId),
    BigInt(validateAndParseAddress(winner)),
    BigInt(p1RoundsWon),
    BigInt(p2RoundsWon),
    BigInt(transcriptHash),
  ];

  return BigInt(hash.computePoseidonHashOnElements(elements));
}

// ---------------------------------------------------------------------------
// Settlement service
// ---------------------------------------------------------------------------

export class SettlementService {
  private supabase: SupabaseClient;
  private serverAccount: Account | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.initializeServerAccount();
  }

  private initializeServerAccount() {
    const privateKey =
      normalizeEnv(process.env.SERVER_ACCOUNT_PRIVATE_KEY) ||
      normalizeEnv(process.env.SERVER_PRIVATE_KEY);
    const address = normalizeEnv(process.env.SERVER_ACCOUNT_ADDRESS);
    const rpcUrl = getRpcUrl();

    if (!privateKey || !address) {
      console.warn('[SettlementService] Server account credentials not configured');
      return;
    }

    const provider = new RpcProvider({ nodeUrl: rpcUrl });
    this.serverAccount = new Account({
      provider,
      address: validateAndParseAddress(address),
      signer: privateKey,
    });
  }

  async generateTranscriptHash(matchId: number): Promise<string> {
    const { data: rounds } = await this.supabase
      .from('match_rounds')
      .select('*')
      .eq('match_id', matchId)
      .order('round_number', { ascending: true });

    if (!rounds) return '0x0';

    const { data: actions } = await this.supabase
      .from('match_actions')
      .select('*')
      .eq('match_id', matchId)
      .order('round_number', { ascending: true });

    if (!actions) return '0x0';

    const transcriptData = rounds.map((round) => ({
      roundNumber: round.round_number,
      btcPrice: round.btc_snapshot,
      ethPrice: round.eth_snapshot,
      strkPrice: round.strk_snapshot,
      solPrice: round.sol_snapshot,
      dogePrice: round.doge_snapshot,
      p1Action: actions.find(
        (a) => a.round_number === round.round_number && a.player_wallet !== null
      )?.action,
      p2Action: actions.find(
        (a) => a.round_number === round.round_number && a.player_wallet !== null
      )?.action,
      winner: round.winner,
    }));

    const dataString = JSON.stringify({ matchId, rounds: transcriptData });
    const keccak = ec.starkCurve.keccak(Buffer.from(dataString));
    return hash.computePoseidonHashOnElements([keccak]);
  }

  /**
   * Lock escrow for a match before it starts.
   *
   * Must be called AFTER both players have joined and the on-chain Match model
   * is in WaitingForOpponent status. Must be called BEFORE the match resolves,
   * because settle_match asserts:
   *   assert(escrow.is_locked, 'Escrow not locked')
   *
   * p1Stake / p2Stake are in raw on-chain STRK units (same denomination as
   * entry_fee stored in the events table). Both players must already have
   * enough strk_balance in-game via escrow_system.deposit_stake.
   */
  async lockMatchEscrow(matchId: number, p1Stake: bigint, p2Stake: bigint): Promise<void> {
    if (!this.serverAccount) {
      console.error('[SettlementService] Server account not initialized — cannot lock escrow');
      return;
    }

    if (p1Stake === 0n && p2Stake === 0n) {
      console.log(`[SettlementService] Match ${matchId} has zero stakes, skipping escrow lock`);
      return;
    }

    console.log(`[SettlementService] Locking escrow for match ${matchId}`, {
      p1Stake: p1Stake.toString(),
      p2Stake: p2Stake.toString(),
    });

    // Cairo fn lock_match_escrow(match_id: u128, p1_stake: u256, p2_stake: u256)
    // u256 serialises as [low, high] — cairo.uint256() handles this correctly
    const calldata = CallData.compile({
      match_id: matchId,
      p1_stake: cairo.uint256(p1Stake),
      p2_stake: cairo.uint256(p2Stake),
    });

    const tx = await this.serverAccount.execute({
      contractAddress: ESCROW_SYSTEM_ADDRESS,
      entrypoint: 'lock_match_escrow',
      calldata,
    });

    console.log(`[SettlementService] Escrow lock tx submitted: ${tx.transaction_hash}`);

    await this.serverAccount.waitForTransaction(tx.transaction_hash, {
      retryInterval: 2_000,
      successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
    });

    console.log(`[SettlementService] Escrow locked for match ${matchId}: ${tx.transaction_hash}`);
  }

  async settleMatch(
    matchId: number,
    winner: string,
    p1RoundsWon: number,
    p2RoundsWon: number,
    transcriptHash: string
  ) {
    if (!this.serverAccount) {
      console.error('[SettlementService] Server account not initialized — check env vars');
      return;
    }

    try {
      // ── Step 1: Compute the Poseidon hash Cairo will verify against ───────
      const messageHash = computeSettlementHash(
        matchId,
        winner,
        p1RoundsWon,
        p2RoundsWon,
        transcriptHash
      );

      // ── Step 2: Raw ECDSA sign over the poseidon hash ─────────────────────
      //
      // Cairo's is_valid_signature (SNIP-6) expects a raw ECDSA [r, s] over
      // the felt252 hash — NOT a SNIP-12 typed-data signature.
      // ec.starkCurve.sign() is the correct primitive here.
      const signerPrivateKey =
        normalizeEnv(process.env.SERVER_ACCOUNT_PRIVATE_KEY) ||
        normalizeEnv(process.env.SERVER_PRIVATE_KEY) || '';

      const rawSig = ec.starkCurve.sign(num.toHex(messageHash), signerPrivateKey);

      const signatureArray: string[] = [
        num.toHex(rawSig.r),
        num.toHex(rawSig.s),
      ];

      console.log(`[SettlementService] Settling match ${matchId}`, {
        winner,
        p1RoundsWon,
        p2RoundsWon,
        transcriptHash,
        messageHash: num.toHex(messageHash),
        signature: signatureArray,
      });

      // ── Step 3: Compile calldata and execute ──────────────────────────────
      //
      // Cairo fn settle_match(match_id, winner, p1_rounds_won, p2_rounds_won,
      //                       transcript_hash, signature: Array<felt252>)
      // CallData.compile with a named object adds the Array length prefix → [2, r, s]
      const calldata = CallData.compile({
        match_id: matchId,
        winner: validateAndParseAddress(winner),
        p1_rounds_won: p1RoundsWon,
        p2_rounds_won: p2RoundsWon,
        transcript_hash: transcriptHash,
        signature: signatureArray,
      });

      const tx = await this.serverAccount.execute({
        contractAddress: ESCROW_SYSTEM_ADDRESS,
        entrypoint: 'settle_match',
        calldata,
      });

      console.log(`[SettlementService] Tx submitted: ${tx.transaction_hash}`);

      await this.serverAccount.waitForTransaction(tx.transaction_hash, {
        retryInterval: 2_000,
        successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
      });

      console.log(`[SettlementService] Confirmed: ${tx.transaction_hash}`);

      await this.supabase.from('transactions').insert({
        tx_hash: tx.transaction_hash,
        tx_type: 'match_settlement',
        player_wallet: winner,
        amount: '0',
        related_id: matchId,
        status: 'confirmed',
      });
    } catch (error) {
      console.error('[SettlementService] Settlement failed:', error);
      throw error;
    }
  }
}