export type WordChainSeat = "A" | "B";

export interface WordChainState {
  // Ordered, lowercase, already-accepted words - the whole chain so far.
  chain: string[];

  // Lowercase single letter the next submitted word must start with.
  // Null only before the very first word of the match.
  required_letter: string | null;

  current_turn: WordChainSeat;

  // Each wrong/duplicate/too-short attempt costs the acting player a
  // strike on their own turn (the turn does NOT pass - they get to try
  // again). Reaching max_strikes ends the match immediately in the
  // opponent's favor. This is the only way the match ends besides the
  // shared resign/forfeit flow every game already has - see
  // docs/phase-10-notes.md for why (no timers, needed a decisive
  // condition without them).
  strikes_a: number;
  strikes_b: number;
  max_strikes: number;

  winner: WordChainSeat | null;
  game_over: boolean;

  a_player_id: string;
  b_player_id: string | null;
}

// What the move API returns in addition to the new state, so the board
// can show *why* a submission did or didn't advance the chain.
export interface WordChainMoveResult {
  success: true;
  state: WordChainState;
  word_accepted: boolean;
  reason?: string;
}
