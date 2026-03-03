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

**Implementation:** `ccwg-server/src/match-orchestrator.ts`

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
│ • Start countdown timer (60 seconds)                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Action Submission Window                          │
│ ─────────────────────────────────────────────────────────── │
│ • Players select: Attack, Defend, or Charge              │
│ • Players select card from deck (if not locked)          │
│ • Submit via WebSocket                                    │
│ • Timeout: auto-submit NoAction after 60 seconds         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Momentum Reveal                                   │
│ ─────────────────────────────────────────────────────────── │
│ • Compare card's asset price: (current - previous)       │
│ • Calculate decimal momentum                              │
│ • Send momentum_reveal event                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Combat Resolution                                │
│ ─────────────────────────────────────────────────────────── │
│ • Evaluate action pair                                    │
│ • Apply damage calculation formula                       │
│ • Execute ability effects (if charge was active)         │
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

### The Five Actions

| Action | Effect | Strategic Use | Limit |
|--------|--------|---------------|-------|
| **Attack** | Direct damage boost from momentum | Offensive pressure | Unlimited |
| **Defend** | Incoming damage reduction | Defensive play | Unlimited |
| **Charge** | Enable card's ability | Setup/combo plays | Once per match |
| **UseAbility** | Trigger charged ability | Ability execution | After Charge |
| **NoAction** | No input (timeout) | Forced by timeout only | N/A |

### Action Mechanics Deep Dive

**Attack**
- Increases outgoing damage via momentum × attack affinity
- Positive momentum = higher damage; negative momentum = lower damage
- In Attack vs Attack: higher computed damage wins the round

**Defend**
- Reduces incoming damage via momentum × defense affinity
- Positive momentum on defense divides momentum effect (less damage taken)
- In Defend vs Defend: lower damage output from both, often a draw

**Charge**
- Limited to **1 charge action per entire match**
- Activates selected card's ability
- All abilities are `charge_triggered` and `once_per_match`
- If both players Charge in the same round: forced draw, both abilities activate

**NoAction**
- Auto-triggered if player doesn't submit before the 60-second timer expires
- Counts as no offensive or defensive value
- vs Attack: NoAction player takes full damage
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
```

**Example Scenario:**
```
BTC Price Last Round:  $45,000
BTC Price This Round:  $45,900
Momentum Calculation:  (45,900 - 45,000) / 45,000 = 0.02 (2%)
```

### Impact on Damage

Momentum feeds into the damage formula via the card's affinity stats and volatility sensitivity.

---

## V. Damage Calculation Formula

### How Damage is Computed

Source: `packages/shared/src/lib/combat/engine.ts` → `CombatEngine.computeDamage()`

```
Step 1: effectiveMomentum = momentum × volatility_sensitivity
        (ability effects like momentum_boost or ignore_negative applied here)

Step 2: momentumPercent = effectiveMomentum × 100

Step 3: Compute adjusted value based on action:
        ┌───────────┬────────────────────────────────────────────────────────────┐
        │ ATTACK    │ if momentumPercent ≥ 0: adjusted = momentumPercent × affinity     │
        │           │ if momentumPercent < 0: adjusted = |momentumPercent| / affinity    │
        ├───────────┼────────────────────────────────────────────────────────────┤
        │ DEFEND    │ if momentumPercent ≥ 0: adjusted = momentumPercent / affinity      │
        │           │ if momentumPercent < 0: adjusted = |momentumPercent| × affinity    │
        ├───────────┼────────────────────────────────────────────────────────────┤
        │ CHARGE    │ if momentumPercent ≥ 0: adjusted = momentumPercent / affinity      │
        │           │ if momentumPercent < 0: adjusted = |momentumPercent| × affinity    │
        └───────────┴────────────────────────────────────────────────────────────┘

Step 4: damage = basePower + adjusted

Step 5: Apply ability damage multipliers (e.g., defense_penalty)

Step 6: damage = max(0, damage)
```

### Card Stats

Each card has these stats:

| Stat | Role |
|------|------|
| `base_power` (or `base`) | Base damage before momentum |
| `attack_affinity` | Multiplier/divisor for Attack action momentum |
| `defense_affinity` | Multiplier/divisor for Defend action momentum |
| `charge_affinity` | Multiplier/divisor for Charge action momentum |
| `volatility_sensitivity` | Scales raw momentum before affinity application |

### Example Calculation

```
Card: base_power = 50, attack_affinity = 1.1, volatility_sensitivity = 1.5
Momentum: +0.02 (2%)
Action: Attack

effectiveMomentum = 0.02 × 1.5 = 0.03
momentumPercent   = 0.03 × 100 = 3.0
adjusted          = 3.0 × 1.1 = 3.3   (Attack + positive momentum)
damage            = 50 + 3.3 = 53.3 → rounds to 53
```

---

## VI. Card Abilities & Special Effects

Each card carries one unique ability that triggers when you **Charge**. All abilities are `charge_triggered` and `once_per_match`.

### Ability Reference (from `ccwg-web/src/config/abilities.ts`)

**1. Bitcoin — HALVING PRESSURE** (`btc_halving_pressure`)
- Type: `momentum_amplifier`
- Effect: `damage_multiplier: 0.5` — you take half incoming damage
- When to Use: When facing heavy attacks, as a tank round

**2. Starknet — ZK-CLOAK** (`strk_zk_cloak`)
- Type: `visibility_denial`
- Effect: `cloak_rounds: 2` — opponent only sees their own data for 2 rounds
- When to Use: When leading, to reduce opponent's information advantage

**3. Dogecoin — LOYAL GUARD** (`doge_loyal_guard`)
- Type: `defensive_reflect`
- Effect: `attack_damage_multiplier: 0.75` — if opponent attacks, their damage is reduced by 25%
- When to Use: Clutch round to survive potential lethal attack

**4. Solana — DE-SYNC** (`sol_desync`)
- Type: `action_lock`
- Effect: `disable_swap: true`, `disable_charge: true`, `duration_rounds: 1`
- Opponent cannot swap cards or Charge for 1 round
- When to Use: To prevent opponent ability combos or lock them onto a bad card

**5. Ethereum — GAS SURGE** (`eth_gas_surge`)
- Type: `momentum_stabilizer`
- Effect: `damage_multiplier: 0.8` — if your momentum is negative, opponent damage reduced by 20%
- When to Use: When your asset price is dropping, to mitigate the penalty

---

## VII. Combat Resolution

### Round Winner Determination

Source: `packages/shared/src/lib/combat/engine.ts` → `CombatEngine.resolveCombat()`

Both players' damage is computed independently. The round winner is determined by the action pairing:

| Player 1 | Player 2 | Winner Logic |
|-----------|----------|-------------|
| Attack | Attack | Higher computed damage wins |
| Attack | Defend | Higher computed damage wins |
| Attack | Charge | Attacker advantage on tie |
| Attack | NoAction | Higher damage wins (attacker usually) |
| Defend | Defend | Lower damage output from both → can draw |
| Defend | Charge | Defender advantage on tie |
| Charge | Charge | Forced draw, both abilities activate |
| NoAction | NoAction | Draw (0 damage each) |

**Key notes:**
- There is no rock-paper-scissors hard counter — damage computation determines outcome
- Charge absorbs a round to activate ability; attacker has tie-break advantage vs Charge
- Defender has tie-break advantage vs Charge
- Ability effects (damage_taken_multiplier, block_action) modify damage before comparison

### Ability Effects in Combat

| Effect Type | Description |
|-------------|-------------|
| `momentum_boost` | Adds to effective momentum |
| `ignore_negative` | Clamps negative momentum to 0 |
| `defense_penalty` | Multiplies damage by `(1 - value/100)` |
| `block_action` | Forces opponent's Attack → Defend |
| `damage_taken_multiplier` | Multiplies incoming damage (e.g., 0.5 = halved) |

---

## VIII. Card Swaps & Limits

### Swap Rules by Mode

| Mode | 3-Round | 5-Round | 10-Round |
|------|---------|---------|----------|
| **VsAI** | 2 | 2 | 999 (unlimited) |
| **Ranked1v1** | 2 | 2 | 999 (unlimited) |
| **Challenge (Fun)** | 999 | 999 | 999 |
| **Challenge (Strict)** | 2 | 2 | 4 |
| **WarZone** | 2 | 2 | 999 (unlimited) |
| **Room** | 2 | 2 | 999 (unlimited) |

Source: `ccwg-web/src/config/constants.ts` (SWAP_LIMITS) and `packages/shared/src/lib/social/shared.ts` (getChallengeSwapLimit)

### Swap Mechanics

- **When:** Can only swap between rounds, not mid-round
- **Cost:** Free (no STRK charged)
- **Effect on Charge:** If you swap after charging, charge state is cleared
- **Card Lock:** After swap, new card is immediately playable next round

---

## IX. Match Formats & Win Conditions

### Best-Of Formats

| Format | Total Rounds | Rounds to Win |
|--------|-------------|---------------|
| Best-of-3 | 3 | 2 |
| Best-of-5 | 5 | 3 |
| Best-of-10 | 10 | 6 |

Winners determined by:
1. First to reach majority round wins → **Match Ends**
2. If tied after all rounds → **Draw declared**

---

## X. Match Data & Types

### Core TypeScript Types

Source: `packages/shared/src/types/`

**RoundResult** (from `game.ts`):
```typescript
interface RoundResult {
  round_number: number;
  p1_action: PlayerAction;
  p2_action: PlayerAction;
  p1_damage: number;
  p2_damage: number;
  winner: string;
  p1_momentum: MomentumData;
  p2_momentum: MomentumData;
  p1_ability_triggered: boolean;
  p2_ability_triggered: boolean;
}
```

**MomentumData** (from `game.ts`):
```typescript
interface MomentumData {
  asset: CardAsset;
  base_price: number;
  snapshot_price: number;
  momentum_percent: number;
}
```

**CardStats** (from `combat/engine.ts`):
```typescript
interface CardStats {
  base: number;
  base_power?: number | null;
  attack_affinity: number;
  defense_affinity: number;
  charge_affinity: number;
  volatility_sensitivity: number;
}
```

---

## XI. XP & Progression

### XP Award Rules

Source: `ccwg-web/src/config/constants.ts`

| Outcome | XP |
|---------|----|
| Win | +100 |
| Loss | +25 |
| Timeout | −10 |

XP is awarded across all modes (VsAI, Ranked, Challenge).

### Stake Multipliers

Higher-stake matches earn bonus XP:

| Tier | Multiplier |
|------|-----------|
| Tier10 (10 STRK) | 1× |
| Tier20 (20 STRK) | 3× |
| Tier100 (100 STRK) | 5× |

---

## XII. Advanced Mechanics

### Timeout Behavior

If a player doesn't submit an action before the 60-second round timer expires:
- Action auto-submits as `NoAction`
- Player takes full, unmitigated damage that round
- Prevents match deadlock indefinitely
- A 2-second grace period (`ROUND_GRACE_PERIOD_MS`) accounts for network latency

### Settlement Logic

**Ranked1v1 Matches:**
- If locked on-chain escrow: on-chain settlement executes via `settle_match`
- If no escrow: off-chain DB write, no blockchain transaction

**Event Matches:**
- Per-match settlement skipped (event stakes locked at registration)
- Only event-level `finalize_event` executes on-chain

**Challenge Matches:**
- No stakes, no on-chain settlement
- Result written to DB only

**Room Matches:**
- Per-match settlement off-chain in Supabase
- Room-level settlement available via Room System on-chain
