export type LudoColor = "red" | "green" | "yellow" | "blue";

export interface LudoSeat {
  user_id: string;
  color: LudoColor;
}

/** state.tokens[seatIndex][tokenIndex] - relative position:
 *  -1 = in the yard, 0-50 = shared outer loop, 51-56 = home column,
 *  57 = home/finished. See migration 056_ludo.sql's header comment
 *  for the full board model. */
export type LudoTokens = number[][];

export interface LudoState {
  game_type: "ludo";
  max_players: number;
  /** Fixed-length 4 array; entries beyond max_players stay null forever. */
  seats: Array<LudoSeat | null>;
  tokens: LudoTokens;
  current_seat: number;
  dice_value: number | null;
  awaiting_move: boolean;
  movable_tokens: number[];
  consecutive_sixes: number;
  winner_seat: number | null;
  game_over: boolean;
}

export const LUDO_COLORS: LudoColor[] = ["red", "green", "yellow", "blue"];

export const LUDO_ENTRY_OFFSET: Record<LudoColor, number> = {
  red: 1,
  green: 14,
  yellow: 27,
  blue: 40,
};

export const LUDO_SAFE_SQUARES = [1, 9, 14, 22, 27, 35, 40, 48];

/** Absolute square (0-51) on the shared outer loop for a color's
 *  relative position. Only meaningful for relative 0-50 - callers must
 *  guard the home-column range (51+) themselves. Mirrors
 *  _ludo_abs_square in migration 056_ludo.sql exactly - keep both in
 *  sync if the board layout ever changes. */
export function ludoAbsSquare(color: LudoColor, relative: number): number {
  return (LUDO_ENTRY_OFFSET[color] + relative) % 52;
}

export function ludoIsSafeSquare(abs: number): boolean {
  return LUDO_SAFE_SQUARES.includes(abs);
}
