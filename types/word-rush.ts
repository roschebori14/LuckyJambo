export type WordRushSeat = "A" | "B";

export interface WordRushState {
  // Server-generated scramble shared by both players for the whole
  // round (12-16 tiles, Boggle-style letter-frequency distribution -
  // see lib/games/word-rush/engine.ts's generateScramble). Neither
  // client ever generates this themselves.
  letters: string[];

  // ISO timestamp of when the round started, and how long it runs -
  // same "started_at + seconds, client derives the deadline" pattern
  // turn_started_at/turn_seconds uses in types/word-chain.ts, just
  // applied to one shared round instead of a per-turn clock. Null
  // only in the brief window between match creation and the opponent
  // joining (mirrors every other game's a-player-seeded/b-player-null
  // "waiting" shape) - round_started_at is set the moment join_match
  // seats the second player, so gameplay starts immediately, exactly
  // like word-chain's current_turn is already 'A' the instant the
  // match goes active.
  round_started_at: string | null;
  round_seconds: number;

  a_player_id: string;
  b_player_id: string | null;

  // Each player has their own independent found-words list and
  // score - unlike word-chain's shared chain, both players can find
  // the same word and both get credit. Words are lowercase, in the
  // order found.
  a_found_words: string[];
  b_found_words: string[];
  a_score: number;
  b_score: number;

  winner: WordRushSeat | null;
  game_over: boolean;
}

// What the submit-word API returns in addition to the new state, so
// the board can show whether a submission actually scored.
export interface WordRushSubmitResult {
  success: true;
  state: WordRushState;
  word_accepted: boolean;
  points?: number;
  reason?: string;
}
