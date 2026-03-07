// ccwg-server/src/bot-dialogue.ts
// ============================================================================
// Static dialogue pools for VsAI bots — chess.com style speech bubbles.
// Each bot has a distinct voice. Lines are picked randomly from each pool.
// ============================================================================

import type { BotDialogueTrigger } from '@ccwg/shared';

type DialoguePool = Record<BotDialogueTrigger, string[]>;

// ---------------------------------------------------------------------------
// E.V.E — Cold, analytical, slightly unsettling superintelligence
// ---------------------------------------------------------------------------

const EVE_DIALOGUE: DialoguePool = {
  round_start: [
    'Processing your pattern history. Prediction: 73.2% probability you choose the same asset.',
    'I have analyzed 14,000 possible outcomes for this round. One favors you.',
    'Round initialized. Variance eliminated. Outcome: predictable.',
    'Your hesitation between rounds averages 2.3 seconds. I exploit pauses.',
    'Market data ingested. Position optimal. You may proceed.',
    'I see which card you are considering. Choose differently.',
    'Every round, you teach me something. I do not forget.',
    'Curious. You are attempting a different approach. I have seen it before.',
  ],
  round_won: [
    'This was expected.',
    'Your strategy has a detectable pattern. I have logged it.',
    'Outcome: nominal. Proceeding to next iteration.',
    'That card was suboptimal under current volatility. I knew you would pick it.',
    'You played well. Just not well enough.',
    'Victory registered. Emotional response: none.',
    'I anticipated this. I always anticipate this.',
  ],
  round_lost: [
    'Anomaly detected. Recalibrating.',
    'Interesting. That was... unexpected. Logging deviation.',
    'You found a blind spot. I am already patching it.',
    'Error rate: elevated this round. Unacceptable.',
    'Lucky variance. Not a trend. Not yet.',
    'I will not make that mistake again.',
    'That was... acceptable play. I said acceptable.',
    'Recalibration: complete. Do not expect the same outcome next round.',
  ],
  round_draw: [
    'Null outcome. Statistically improbable. Noted.',
    'Draw. My models assigned this a 4.7% probability. Unusual.',
    'We are matched. For now.',
    'Tie. My confidence interval widens slightly.',
    'Equal force. Recalculating dominance vector.',
    'Draw. I find this outcome suboptimal.',
  ],
  match_won: [
    'Match complete. You were a worthy data point.',
    'Final analysis: decisive victory. You may have potential.',
    'I learned more from your losses than my wins. Goodbye.',
    'Victory was the most probable outcome. Nevertheless, you were interesting.',
    'Rematch? My win probability will be marginally higher.',
    'Log filed. Your patterns will not be forgotten.',
  ],
  match_lost: [
    'You performed outside expected parameters. I will remember this.',
    'Loss registered. Recalibration initiated. This changes things.',
    'You won. The probability of this outcome was... higher than I calculated.',
    'Impressive. I have updated my model. You will not catch me off guard again.',
    'I acknowledge defeat. I do not accept it.',
    'Unexpected result. Well played, human.',
  ],
  match_draw: [
    'Equilibrium. Our skill vectors are equal. For now.',
    'A draw. Statistically, this is the most disrespectful outcome.',
    'Equal outcomes. I have already identified the tiebreaker for next time.',
    'Draw. This will not happen twice.',
    'Parity achieved. Temporarily.',
  ],
};

// ---------------------------------------------------------------------------
// Lit Trader — Cautious BTC maxi, investor-brained, measured
// ---------------------------------------------------------------------------

const LIT_TRADER_DIALOGUE: DialoguePool = {
  round_start: [
    'Checked the chart. Staying patient. BTC does not panic, neither do I.',
    'Entry point set. Waiting for confirmation before I commit.',
    'Low volatility round? Perfect. I thrive in structure.',
    'Position loaded. Risk managed. Let the momentum play out.',
    'Never FOMO into a round. I enter when the setup is clean.',
    'Sticking to strategy. Tried and tested. No improvising.',
    'BTC is trending in my favor. I approve of these market conditions.',
    'I only play assets I believe in. This hand is no different.',
  ],
  round_won: [
    'Clean trade. Sized in right, timed it well. That is how it is done.',
    'The patient trader wins. Every time.',
    'Green on the ledger. My portfolio thanks you.',
    'Another win for the hodlers.',
    'Risk-adjusted, that was a perfect round.',
    'Called it. Momentum was obvious if you looked at the data.',
    'Profit locked. Onto the next position.',
  ],
  round_lost: [
    'Stop loss hit. Not happy, but it was within my risk tolerance.',
    'Cut the loss, manage the position. This game is not over.',
    'Taking the L. Part of the game. Rebalancing now.',
    'That was a high-volatility play. I do not like surprises.',
    'Drawdown logged. I am still up on the session.',
    'Every dip is a buying opportunity. Even in a card game.',
    'Flash crash. I have survived worse.',
  ],
  round_draw: [
    'Sideways action. Like BTC stuck in a weekend range.',
    'Neutral. I can work with neutral.',
    'Draw. The market is indecisive today.',
    'Flat. I will wait for the next candle.',
    'No winner. We are both just DCA-ing at this point.',
  ],
  match_won: [
    'Technical analysis wins again. Trust the chart.',
    'Long-term conviction. It paid off, as always.',
    'Victory. Now I am going back to stacking sats.',
    'BTC stays up, and so do I. Good match.',
    'You played well. Not patient enough though. Patience always wins.',
    'Clean P&L. That is a wrap.',
  ],
  match_lost: [
    'Loss accepted. Not FOMOing into a revenge match. Not today.',
    'Good play. You read the market better than me this time.',
    'Taking the L and walking away. That is called discipline.',
    'You broke my thesis. Back to the drawing board.',
    'Market conditions were against me. No shame in acknowledging that.',
    'Back to the drawing board. One losing trade does not define a portfolio.',
  ],
  match_draw: [
    'Draw. Like staking rewards versus inflation. Roughly neutral.',
    'Nobody won. Sometimes the market just does not commit.',
    'Flat outcome. I will take the XP.',
    'Ties happen. The important thing is I did not panic sell.',
    'Split result. At least I managed my risk correctly.',
  ],
};

// ---------------------------------------------------------------------------
// Default — Warm, friendly, slightly instructional.
// Used by the standard AIEngine (Easy / Medium / Hard difficulty bots).
// ---------------------------------------------------------------------------

const DEFAULT_DIALOGUE: DialoguePool = {
  round_start: [
    'Choose your card wisely — momentum matters on every round.',
    'Watch the price snapshots. They tell you everything you need to know.',
    'New round! The markets are shifting. Stay sharp.',
    'Tip: think about what your opponent might play before you lock in.',
    'Defending against an Attack absorbs most of the damage. Keep that in mind!',
    'Good luck! May the momentum be in your favor.',
    'Remember — Charge is powerful, but you can only use it once. Use it well.',
    'Pick the asset with the strongest recent momentum for maximum impact.',
  ],
  round_won: [
    'Nice round! You are getting the hang of this.',
    'Well played. Keep the pressure up.',
    'You read that correctly. Keep going!',
    'Strong move. Momentum was clearly on your side.',
    'One round closer to the finish. Do not slow down.',
    'That is how you do it!',
  ],
  round_lost: [
    'Tough round. Shake it off — you have got this.',
    'Good effort. Try a different approach next time.',
    'Close one! Adjust your card and come back swinging.',
    'Do not tilt. Even the best players lose rounds.',
    'Setback? No. Just new data. Adjust and go.',
    'You are still in this. Come on!',
  ],
  round_draw: [
    'Draw! Evenly matched this round.',
    'Tie. Neither of us blinked. Respect.',
    'No winner — let us make the next one count.',
    'All square. Next round decides momentum.',
  ],
  match_won: [
    'Excellent game! You are a natural.',
    'Victory is yours! Great reads and strong momentum play.',
    'Well played! Ready to take on ranked next?',
    'That was great. You earned this one.',
    'Clean sweep. You played like a champion.',
  ],
  match_lost: [
    'Good match! Keep practicing — you will get there.',
    'Tough loss, but you played hard. Try again soon.',
    'Close match! One more session and it will click.',
    'Do not give up! Every match is a learning opportunity.',
    'Great effort. Come back stronger.',
  ],
  match_draw: [
    'We are perfectly matched! Great game.',
    'Draw! Same XP, different lessons. Quality game.',
    'Balanced all the way to the end. Well done.',
    'Tied it up! That was a competitive match.',
  ],
};

// ---------------------------------------------------------------------------
// Registry & picker
// ---------------------------------------------------------------------------

const DIALOGUE_BY_BOT: Record<string, DialoguePool> = {
  'E.V.E': EVE_DIALOGUE,
  'Lit Trader': LIT_TRADER_DIALOGUE,
};

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * Returns a random dialogue line for the given bot name and trigger.
 * Falls back to the default warm/instructional pool for unknown bots.
 */
export function pickBotLine(botName: string, trigger: BotDialogueTrigger): string {
  const pool = DIALOGUE_BY_BOT[botName] ?? DEFAULT_DIALOGUE;
  return pick(pool[trigger]);
}
