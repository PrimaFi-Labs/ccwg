-- ============================================================================
-- 032 — Add Lit Trader bot (Cautious Conservative Trader)
-- ============================================================================

INSERT INTO bots (name, difficulty, preferred_assets, aggression, defense, charge_bias, description, enabled, avatar_url)
VALUES
  (
    'Lit Trader',
    'Medium',
    ARRAY['BTC'],
    30,
    80,
    15,
    'A cautious trader who plays it safe. Prefers BTC stability, avoids volatile swings, and never gambles. Slow and steady wins the race... or does it?',
    TRUE,
    '/assets/logo/lit-trader-thumb.png'
  )
ON CONFLICT (name) DO UPDATE SET
  difficulty = EXCLUDED.difficulty,
  preferred_assets = EXCLUDED.preferred_assets,
  aggression = EXCLUDED.aggression,
  defense = EXCLUDED.defense,
  charge_bias = EXCLUDED.charge_bias,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  avatar_url = EXCLUDED.avatar_url;
