// Headless runner for the Four in a Row boardgame.io Game.
//
// boardgame.io ships a full multiplayer stack (Client + Server +
// socket.io transport) for the case where *it* owns realtime delivery
// and state storage. This app already has that - Supabase Postgres is
// the single source of truth and `useMatchRealtime` is the one realtime
// path every game (chess, draughts, battleship, snakes & ladders) uses.
// Standing up a second, competing transport just to get boardgame.io's
// move validation would mean two realtime systems telling the UI two
// different things.
//
// So this file takes the middle path the project's own roadmap calls
// for: treat `FourInARowGame` (see ./game.ts) purely as a rules object.
// Each API request reconstructs a boardgame.io `ctx` from the persisted
// Supabase row, calls the Game's own `moves.dropDisc` and `endIf`
// directly, and hands the result back to the caller (the API route),
// which persists it through the same optimistic-concurrency Postgres
// RPC pattern chess/draughts already use
// (`apply_four_in_a_row_move_result`, see migration 050).
//
// Note on typing: boardgame.io's `Ctx` type carries a lot of multiplayer
// bookkeeping (`playOrder`, `phase`, `random`, `events`, ...) that a
// real Client/Server would populate for you. We only ever read
// `ctx.currentPlayer` inside `FourInARowGame`'s move/endIf functions, so
// rather than hand-construct (and risk drifting out of sync with) that
// entire interface, the minimal context below is passed through an
// explicit `as never` cast at the one call site. If this project later
// adopts boardgame.io's full Client/Master for real, this file is the
// only place that changes.

import { INVALID_MOVE } from "boardgame.io/core";
import { FourInARowGame, findWinningLine, isBoardFull, ROWS, COLS, type Disc } from "./game";

export interface FourInARowState {
  cells: Array<Disc | null>;
  column_heights: number[];
  current_turn: Disc;
  winner: Disc | null;
  winning_line: number[] | null;
  is_draw: boolean;
  game_over: boolean;
  r_player_id: string;
  y_player_id: string | null;
}

export function createInitialState(creatorId: string): FourInARowState {
  return {
    cells: Array(ROWS * COLS).fill(null),
    column_heights: Array(COLS).fill(0),
    current_turn: "R",
    winner: null,
    winning_line: null,
    is_draw: false,
    game_over: false,
    r_player_id: creatorId,
    y_player_id: null,
  };
}

export class FourInARowRulesError extends Error {}

// Applies one `dropDisc` move via the real boardgame.io Game definition
// and returns the fully updated persistence-shaped state. Throws
// FourInARowRulesError for anything the caller should surface as a 400
// (not your turn, column full, game already over, ...).
export function applyDropDisc(state: FourInARowState, playerId: string, column: number): FourInARowState {
  if (state.game_over) {
    throw new FourInARowRulesError("This match has already ended");
  }

  const isR = state.r_player_id === playerId;
  const isY = state.y_player_id === playerId;
  if (!isR && !isY) {
    throw new FourInARowRulesError("You are not a participant in this match");
  }

  const mySeat: Disc = isR ? "R" : "Y";
  if (state.current_turn !== mySeat) {
    throw new FourInARowRulesError("It's not your turn");
  }

  const G = {
    cells: state.cells,
    columnHeights: state.column_heights,
    winner: state.winner,
    winningLine: state.winning_line,
  };
  const ctx = { currentPlayer: mySeat === "R" ? "0" : "1" };

  const moveFn = FourInARowGame.moves!.dropDisc as unknown as (context: unknown, col: number) => typeof G | typeof INVALID_MOVE;
  const result = moveFn({ G, ctx } as never, column);

  if (result === INVALID_MOVE || result === undefined) {
    throw new FourInARowRulesError(
      column < 0 || column >= COLS || !Number.isInteger(column)
        ? "Invalid column"
        : "That column is full",
    );
  }

  const newG = result;
  // findWinningLine/isBoardFull mirror exactly what FourInARowGame.endIf
  // computes internally - re-deriving here keeps this file self
  // contained without reaching back into the Game object's closures.
  const winResult = findWinningLine(newG.cells);
  const gameOver = !!winResult || isBoardFull(newG.cells);
  const isDraw = !winResult && isBoardFull(newG.cells);

  return {
    cells: newG.cells,
    column_heights: newG.columnHeights,
    current_turn: mySeat === "R" ? "Y" : "R",
    winner: winResult?.disc ?? null,
    winning_line: winResult?.line ?? null,
    is_draw: isDraw,
    game_over: gameOver,
    r_player_id: state.r_player_id,
    y_player_id: state.y_player_id,
  };
}
