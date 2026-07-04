// Shared constants/types for Snakes & Ladders. The LADDERS/SNAKES maps
// here must stay in sync with `_snakes_ladders_landing` in
// supabase/migrations/037_snakes_and_ladders.sql - this file only
// mirrors them for client-side rendering (drawing the board and
// animating a token's path), it never decides where a roll lands.
// That's computed server-side so a tampered client can't spoof it.

export const BOARD_SIZE = 100;
export const GRID_DIM = 10;
export const MAX_ROLLS = 200;

// Ladders: bottom -> top
export const LADDERS: Record<number, number> = {
  2: 23,
  8: 34,
  20: 77,
  32: 68,
  41: 79,
  74: 88,
  82: 100,
};

// Snakes: head -> tail
export const SNAKES: Record<number, number> = {
  17: 4,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 68,
  95: 75,
  99: 78,
};

export interface LastRoll {
  player_id: string;
  roll: number;
  from: number;
  to: number;
  used_ladder: boolean;
  used_snake: boolean;
}

export interface SnakesLaddersState {
  game_type: "snakes_ladders";
  player_1_id: string;
  player_2_id: string | null;
  current_turn: string | null;
  positions: Record<string, number>;
  last_roll: LastRoll | null;
  rolls_used: number;
  max_rolls: number;
  winner_id: string | null;
  game_over: boolean;
}

/**
 * Converts a 1-100 square number into { row, col } on a standard
 * boustrophedon (snaking) 10x10 board: row 0 is squares 91-100 (top),
 * odd rows run right-to-left, even rows left-to-right - the classic
 * layout everyone recognizes from a physical board.
 */
export function squareToRowCol(square: number): { row: number; col: number } {
  const idx = square - 1;
  const row = 9 - Math.floor(idx / 10);
  const rowIndexFromBottom = Math.floor(idx / 10);
  const posInRow = idx % 10;
  const col = rowIndexFromBottom % 2 === 0 ? posInRow : 9 - posInRow;
  return { row, col };
}
