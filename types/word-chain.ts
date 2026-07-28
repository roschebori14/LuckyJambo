export type WordChainSeat = "A" | "B";

export interface WordChainState {
  // Ordered, lowercase, already-accepted words - the whole chain so far.
  chain: string[];

  // Lowercase single letter the next submitted word must start with.
  // Null only before the very first word of the match.
  required_letter: string | null;

  current_turn: WordChainSeat;

  // Each wrong/duplicate/too-short attempt or turn timeout costs the
  // acting player a strike on their own turn (the turn does NOT pass -
  // they get to try again with a fresh clock). Reaching max_strikes
  // ends the match immediately in the opponent's favor.
  strikes_a: number;
  strikes_b: number;
  max_strikes: number;

  winner: WordChainSeat | null;
  game_over: boolean;

  a_player_id: string;
  b_player_id: string | null;

  // ISO timestamp of when the current turn began, and how many
  // seconds each player gets to submit a word once it's their turn.
  // Enforced server-side (see apply_word_chain_timeout in
  // 056_word_chain_turn_timer.sql) - the deadline is computed from
  // this timestamp, never from a client-reported "time's up", so
  // stalling on purpose (e.g. to look a word up elsewhere) can't be
  // dodged by simply not calling the timeout endpoint yourself: your
  // opponent's client is watching the same clock and can report it.
  turn_started_at: string;
  turn_seconds: number;
}

// What the move API returns in addition to the new state, so the board
// can show *why* a submission did or didn't advance the chain.
export interface WordChainMoveResult {
  success: true;
  state: WordChainState;
  word_accepted: boolean;
  reason?: string;
  timed_out?: boolean;
}

export interface WordChainStateResponse {
  success: true;
  state: WordChainState;
  server_time: string;
}
