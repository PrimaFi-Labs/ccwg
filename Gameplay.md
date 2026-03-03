# CCWG Gameplay Technical Handbook

<div align="center">

**Complete gameplay mechanics reference** | Real-time combat engine, momentum systems, and card abilities

</div>

---

## I. Match Architecture

### Authoritative Server Orchestration

<div style="background: #f0f7ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0;">

**Key Principle:** All gameplay is **server-authoritative**. The client displays game state but cannot predict or simulate ahead. The WebSocket server is the single source of truth.

</div>

**Implementation:** `ccwg-web/server/match-orchestrator.ts`

This ensures:
- ✅ Anti-cheat (no client-side deception possible)
- ✅ Fair momentum calculation from canonical price feeds
- ✅ Tamper-proof action resolution
- ✅ Deterministic game outcomes for audit trails

---

## II. The Round Resolution Pipeline

Each round follows this strict sequence:

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Round Initialization                              │
│ ─────────────────────────────────────────────────────────── │
│ • Retrieve current asset prices from oracle               │
│ • Send round_start event to both players                  │
│ • Start countdown timer (typically 30-60 seconds)         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Action Submission Window                          │
│ ─────────────────────────────────────────────────────────── │
│ • Players select: Attack, Defend, or Charge              │
│ • Players select card from deck (if not locked)          │
│ • Submit via /api/matches/{id}/actions                   │
│ • Timeout: auto-submit NoAction                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Momentum Reveal                                   │
│ ─────────────────────────────────────────────────────────── │
│ • Compare card's asset price: (current - previous)       │
│ • Calculate decimal momentum | Convert to basis points   │
│ • Send momentum_reveal event (no longer predictable)     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Combat Resolution                                │
│ ─────────────────────────────────────────────────────────── │
│ • Evaluate action pair (8 possible combinations)         │
│ • Apply damage calculation formula                       │
│ • Execute ability effects (if relevant)                 │
│ • Determine round winner or draw                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Round Completion                                 │
│ ─────────────────────────────────────────────────────────── │
│ • Send round_end event with results                      │
│ • Update player health/status                            │
│ • Check if match is complete (majority wins reached)     │
│ • If match over: Generate transcript hash & finalize     │
└─────────────────────────────────────────────────────────────┘
```

---

## III. Player Actions

### The Four Core Actions

| Action | Effect | Strategic Use | Cost |
|--------|--------|----------------|----|
| **Attack** | Direct damage boost | Offensive pressure | None |
| **Defend** | Incoming damage reduction | Defensive play | None |
| **Charge** | Enable ability next round | Setup/combo plays | 1 per match |
| **NoAction** | Take round off (timeout) | Forced by timeout only | None |

### Action Mechanics Deep Dive

**Attack**
- Increases outgoing damage via momentum affinity
- Positive momentum = higher damage multiplier (up to +60%)
- Vulnerable to Defend if opponent predicts correctly
- Ties vs Attack: Higher base power wins

**Defend** 
- Reduces incoming damage via momentum immunity
- Negative momentum becomes negligible (-5% instead of -60%)
- Leaves player passive (low damage output)
- Ties vs Defense: Both take minimal damage

**Charge**
- Limited to **1 charge action per entire match**
- Activates selected card's ability for next round
- Ability effects can persist for 2-5 rounds post-activation
- Cannot be used by both players in same round (API prevents it)

**NoAction**
- Auto-triggered if player doesn't submit before timer expires
- Counts as "no defensive value"
- vs Attack: Attacker usually wins (takes unmitigated damage)
- vs Defend: Defender's partial mitigation still applies
- Both NoAction: Draw round (0 damage each)

---

## IV. Momentum & Asset Price Dynamics

### What is Momentum?

Momentum represents how an asset's price has moved since the last round. It's the core variable affecting combat damage.

### Momentum Calculation

```
Input:    Previous Round Price, Current Round Price
          ↓
          Formula: (Current - Previous) / Previous
          ↓
Output:   Decimal (e.g., 0.05 = +5%, -0.03 = -3%)
          ↓
For Display: × 10,000 = Basis Points (-500 to +1,000 typical range)
```

**Example Scenario:**
```
BTC Price Last Round:  $45,000
BTC Price This Round:  $45,900
Momentum Calculation:  (45,900 - 45,000) / 45,000 = 0.02 (2%)
Momentum (bps):        200 basis points
```

### Impact on Damage

The momentum is now applied to your selected card's affinity stats:

**Card Example - "Bitcoin Base Card":**
- Base Power: 50
- Attack Affinity: 1.2× (120%)
- Defense Affinity: 0.85× (85%)
- Charge Affinity: 1.0× (100%)

**Scenario: Momentum = +200 bps (0.02 gain)**

| Action | Calculation | Final Damage |
|--------|------------|--------------|
| Attack | 50 × (1 + 0.02 × 1.2) = 50 × 1.024 | **51.2** |
| Defend | 50 × (1 - 0.02 × 0.85) = 50 × 0.983 | 49.15 (converted to mitigation) |
| Charge | 50 × (1 + 0) | 50 (charge uses ability, not momentum scaling) |

---

## V. Card Affinity System

### Understanding Card Stats

Each card has four core stats that determine its playstyle:

```
┌─────────────────────────────────────────────┐
│  "Ethereum Guardian"                        │
├─────────────────────────────────────────────┤
│ Base Power:          45 points              │
│ Attack Affinity:     0.95× (weakness)       │
│ Defense Affinity:    1.15× (strength)       │
│ Charge Affinity:     0.90× (weakness)       │
│ Volatility Sens:     1.8× (high swing)      │
│ Ability ID:          eth_gas_surge          │
└─────────────────────────────────────────────┘
```

### Affinity Interpretation

- **1.2×** - Multiplier above 1.0 = Favorable to momentum
- **0.85×** - Multiplier below 1.0 = Momentum has reduced effect
- **1.0×** - No scaling; static behavior

### Volatility Sensitivity

Represents how much the card is affected by extreme price swings:

- **Low (0.8×)** - Stable cards, consistent performance
- **High (2.0×+)** - Volatile cards, risky but rewarding

A volatile card with +10% momentum gains more damage but also takes more damage with -10% momentum.

---

## VI. Card Abilities & Special Effects

Each card carries one unique ability that triggers when you **Charge**. Abilities can:
- Boost momentum for next round
- Shield against opponent actions
- Disable opponent abilities
- Apply damage multipliers

### Seeded Abilities Reference

**1. Bitcoin Halving Pressure**
- Effect: `damage_taken_multiplier: 0.5×` (you take half incoming damage)
- Duration: Charge resolution window
- When to Use: After taking heavy damage, to "tank" effectively
- Counter: Opponent should attack less, or use defense-focusing abilities

**2. Starknet ZK Cloak**  
- Effect: `opponent_information_obscured`, `cloak_rounds` (default 2)
- Duration: Config-driven cloak window (default 2-round window)
- When to Use: When leading, to reduce opponent's predictability
- Counter: Mix actions more frequently

**3. Doge Loyal Guard**
- Effect: If opponent attacks, incoming damage is reduced (`attack_damage_multiplier`, default 0.75)
- Duration: Charge resolution window
- When to Use: Clutch round to survive potential lethal
- Counter: Charge your own card for synergy

**4. Solana Desync**
- Effect: `opponent_charge_locked + opponent_swap_locked`
- Duration: Config-driven lock window (`duration_rounds`, default 1)
- When to Use: To prevent opponent ability combos
- Counter: Be tactical with card selection before desync lands

**5. Ethereum Gas Surge**
- Effect: If your momentum is negative, incoming damage is reduced (`damage_multiplier`, default 0.8)
- Duration: Charge resolution window (conditional)
- When to Use: When asset momentum is tanking
- Counter: Attack more aggressively before charge resolves

### Strategic Ability Sequencing

Optimal ability usage pattern:
```
Round 1-3:   Gather intel on opponent's play style
Round 2-5:   Charge ability when you predict opponent's weakness
Round 6-N:   Use ability effects to swing momentum in your favor
Round N-1:   Hold charge for potential comeback
Round N:     Deploy charge if match is tight
```

---

## VII. Combat Resolution Matrix

### All 8 Action Pair Outcomes

| Attacker | Defender | Outcome | Damage to Def |
|----------|----------|---------|--------------|
| Attack | Attack | Higher base power wins | Base × momentum ×  affinity |
| Attack | Defend | Attacker wins | Base × momentum × 0.4 (reduced) |
| Attack | Charge | Attacker advantage | Base × momentum |
| Attack | NoAction | Attacker wins (heavy) | Base × momentum × 1.2 |
| Defend | Attack | Defender partial | Base × momentum × 0.5 |
| Defend | Defend | Draw (no damage) | 0 (both mitigate) |
| Defend | Charge | Charge priority | Low damage to defender |
| Defend | NoAction | Defender advantage | 0 (passive vs passive) |
| Charge | Attack | Charge often draws | Ability activates, damage varies |
| Charge | Defend | Mixed outcome | Ability triggers, defender mitigates |
| Charge | Charge | Force draw | Both abilities activate next round |
| Charge | NoAction | Charge advantage | Ability setup + damage |

### Key Tactical Principles

1. **Rock-Paper-Scissors Balance:**
   - Attack > NoAction > Defend > Attack
   - No pure dominant strategy

2. **Charge Power:**
   - Charges can only be used once per match
   - Both players charging in same round is prevented
   - Ability effects persist for multiple rounds

3. **Momentum Variance:**
   - Positive momentum helps Attack
   - Negative momentum helps Defend
   - Extreme swings create tactical opportunities

---

## VIII. Card Swaps & Limits

### Swap Rules

| Match Type | Swaps Available | When |
|-----------|-----------------|------|
| VsAI | Unlimited (999) | Anytime between rounds |
| 10-Round | Unlimited (999) | Anytime between rounds |
| 3-Round | 2 swaps | Anytime between rounds |
| 5-Round | 2 swaps | Anytime between rounds |

### Swap Mechanics

- **Time:** Can only swap between rounds, not mid-round
- **Cost:** Free (no STRK charged)
- **Effect on Charge:** If you swap after charging, charge state is cleared
- **Card Lock:** After swap, new card is immediately playable next round

### Strategic Swapping

```
Scenario: You charged Bitcoin but opponent also charged
Optimal Play:
  1. After round resolves, check opponent's card
  2. If unfavorable matchup, swap to counter-card
  3. New card ready immediately (charge cleared but that's OK)
  4. Opponent must decide: charge next round or pass?
```

---

## IX. Match Formats & Win Conditions

### Best-Of Formats

| Format | Total Rounds | Rounds to Win |
|--------|--------------|---------------|
| Best-of-3 | 3 | 2 |
| Best-of-5 | 5 | 3 |
| Best-of-10 | 10 | 6 |

Winners determined by:
1. First to reach majority rounds wins → **Match Ends**
2. If tied after all rounds → **Draw declared**

### Draw Mechanics

- Both win/loss counts increment
- Slightly affects ranking (no rating change typically)
- Rare to occur in high-stakes matches

---

## X. Match Data & Audit Trail

### Data Captured Per Match

**Match Record:**
```tsx
{
  match_id: "0x123abc...",
  player_1: { address, deck, final_sp_delta },
  player_2: { address, deck, final_sp_delta },
  mode: "Ranked1v1",
  status: "Completed",
  winner: "player_1",
  rounds_won: [1, 1, 2], // Scores per round
  transcript_hash: "0x7f9e...", // Immutable proof
  created_at: "2025-02-26T14:32:00Z",
  settled_on_chain: true,
  settlement_tx: "0x2a3f..."
}
```

**Per-Round Snapshot:**
```tsx
{
  round_num: 3,
  asset: "ETH",
  price_previous: 2800,
  price_current: 2850,
  momentum_bps: 178,
  player_1_action: "Attack",
  player_1_card: "eth_guardian",
  player_2_action: "Defend",
  player_2_card: "btc_fortress",
  damage_to_p1: 25,
  damage_to_p2: 12,
  round_winner: "player_2", // Took less damage
  ability_triggered: null
}
```

---

## XI. Stark Points (SP) & Progression

### SP Award Rules

**Ranked PvP (Non-Event):**
- Win: +30 to +50 SP (varies by opponent strength)
- Draw: +5 SP
- Loss: -30 to -10 SP (varies by opponent strength)

**VsAI:**
- Easy Bot: +10 SP
- Medium Bot: +20 SP
- Hard Bot: +40 SP

**Events:**
- Not awarded per-match
- Awarded at event end based on final ranking

### SP Tiers

| Tier | SP Range | Rank |
|------|----------|------|
| Bronze | 0-500 | New Players |
| Silver | 500-1500 | Casual Players |
| Gold | 1500-3000 | Competitive |
| Platinum | 3000-5000 | Elite |
| Diamond | 5000+ | Top 1% |

---

## XII. Advanced Mechanics

### Timeout Behavior

If a player doesn't submit an action before the round timer expires:
- Action auto-submits as `NoAction`
- Player still takes full damage that round
- Prevents match deadlock indefinitely

### Settlement Logic

**Ranked1v1 Matches:**
- If locked on-chain escrow: on-chain settlement executes via `settle_match`
- If no escrow: off-chain DB write, no blockchain transaction

**Event Matches:**
- Per-match settlement skipped (event stakes locked at registration)
- Only event-level `finalize_event` executes on-chain

**Room Matches:**
- All accounting off-chain in Supabase
- Room settlement at expiration or completion

