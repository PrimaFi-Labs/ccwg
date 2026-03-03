// backend/match-engine.js

import { Account, Contract, RpcProvider, hash, ec } from "starknet";

class MatchEngine {
  async startMatch(matchId) {
    // 1. Fetch match from chain
    const match = await this.getMatch(matchId);
    
    // 2. Initialize round 1
    await this.startRound(matchId, 1);
    
    // 3. Wait for player actions (60 seconds)
    const actions = await this.collectPlayerActions(matchId, 1, 60000);
    
    // 4. Fetch snapshot from chain
    const snapshot = await this.getRoundSnapshot(matchId, 1);
    
    // 5. Calculate round winner off-chain
    const roundWinner = this.calculateRoundWinner(match, actions, snapshot);
    
    // 6. Advance round on-chain
    await this.advanceRound(matchId, roundWinner);
    
    // 7. Repeat for rounds 2, 3, etc.
    // ...
    
    // 8. After final round, settle match
    const finalWinner = this.determineFinalWinner(match);
    await this.settleMatch(matchId, finalWinner);
  }
  
  async startRound(matchId, roundNumber) {
    // Call on-chain: round_engine.start_round(matchId)
    // This captures the oracle snapshot
    const tx = await this.roundEngineContract.start_round(matchId);
    await provider.waitForTransaction(tx.transaction_hash);
  }
  
  calculateRoundWinner(match, actions, snapshot) {
    // Off-chain logic:
    // 1. Get momentum from snapshot
    // 2. Apply player actions (Attack/Defend/Charge)
    // 3. Apply abilities (Week 3)
    // 4. Return winner address
    
    const p1Card = this.getCard(match.p1_active_card_id);
    const p2Card = this.getCard(match.p2_active_card_id);
    
    const p1Momentum = this.calculateMomentum(
      snapshot.round_number,
      p1Card.asset,
      snapshot
    );
    
    const p2Momentum = this.calculateMomentum(
      snapshot.round_number,
      p2Card.asset,
      snapshot
    );
    
    // Basic logic (Week 2)
    if (p1Momentum > p2Momentum) return match.player_1;
    if (p2Momentum > p1Momentum) return match.player_2;
    
    // Tie - higher base power wins
    return p1Card.base_power > p2Card.base_power 
      ? match.player_1 
      : match.player_2;
  }
  
  calculateMomentum(roundNumber, asset, snapshot) {
    if (roundNumber < 2) return 0; // No previous round
    
    const prevSnapshot = await this.getRoundSnapshot(
      snapshot.match_id,
      roundNumber - 1
    );
    
    const currentPrice = this.getPriceForAsset(asset, snapshot);
    const prevPrice = this.getPriceForAsset(asset, prevSnapshot);
    
    // momentum = ((current - prev) / prev) * 10000
    return ((currentPrice - prevPrice) / prevPrice) * 10000;
  }
  
  async settleMatch(matchId, winner) {
    const match = await this.getMatch(matchId);
    
    // Create settlement message
    const messageHash = hash.computePoseidonHashOnElements([
      matchId.toString(),
      winner,
      match.p1_rounds_won.toString(),
      match.p2_rounds_won.toString(),
      "0x0" // transcript_hash (Week 3)
    ]);
    
    // Sign with server account
    const signature = ec.starkCurve.sign(
      messageHash,
      process.env.SERVER_PRIVATE_KEY
    );
    
    // Call escrow_system.settle_match
    const tx = await this.escrowContract.settle_match(
      matchId,
      winner,
      match.p1_rounds_won,
      match.p2_rounds_won,
      "0x0", // transcript_hash
      [signature.r.toString(), signature.s.toString()] // signature array
    );
    
    await provider.waitForTransaction(tx.transaction_hash);
  }
}