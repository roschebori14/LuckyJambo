// Four in a Row (Connect 4) - rules engine
//
// This is a real boardgame.io `Game` config (the same shape boardgame.io's
// own Client/Server would consume: setup / moves / turn / endIf), authored
// against boardgame.io's public, documented types and its `INVALID_MOVE`
// sentinel from `boardgame.io/core`. It's the single source of truth for
// "is this move legal" and "has someone won/drawn" - nothing else in the
// codebase re-implements Connect Four rules.
//
// How it's actually run: see `engine.ts` in this folder. This project
// doesn't stand up boardgame.io's own multiplayer transport (that would
// mean a second realtime path fighting the Supabase-realtime one every
// other game already uses) - instead `engine.ts` invokes this Game
// object's `moves` and `endIf` directly, once per API request, against
// state reconstructed from the `matches.game_state` row, exactly like the
// existing chess (chess.js) / draughts engines already do. That keeps
// boardgame.io as the authored rules engine while persistence stays on
// the same Postgres RPC pattern (see supabase/migrations/050_four_in_a_row.sql)
// as every other game.

import type { Game } from "boardgame.io";
import { INVALID_MOVE } from "boardgame.io/core";

export const ROWS = 6;
export const COLS = 7;

export type Disc = "R" | "Y";

export interface FourInARowG {
  // 42 cells, row-major, row 0 = top of the board, row 5 = bottom.
  cells: Array<Disc | null>;
  // How many discs currently sit in each of the 7 columns - lets a move
  // find "the next open row" in O(1) instead of scanning the column.
  columnHeights: number[];
  winner: Disc | null;
  winningLine: number[] | null;
}

function cellIndex(row: number, col: number): number {
  return row * COLS + col;
}

// Scans the whole board for four-in-a-row in any of the four directions.
// Returns the winning disc colour and the 4 cell indices that made it, or
// null if there's no winner yet. Simple full-board scan (42 cells) is
// plenty fast for a turn-based, human-paced game - no need to optimize to
// "only check around the last move".
export function findWinningLine(cells: Array<Disc | null>): { disc: Disc; line: number[] } | null {
  const directions = [
    { dr: 0, dc: 1 }, // horizontal
    { dr: 1, dc: 0 }, // vertical
    { dr: 1, dc: 1 }, // diagonal down-right
    { dr: 1, dc: -1 }, // diagonal down-left
  ];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const disc = cells[cellIndex(row, col)];
      if (!disc) continue;

      for (const { dr, dc } of directions) {
        const line = [0, 1, 2, 3].map((i) => ({ row: row + dr * i, col: col + dc * i }));
        const inBounds = line.every((p) => p.row >= 0 && p.row < ROWS && p.col >= 0 && p.col < COLS);
        if (!inBounds) continue;

        const allMatch = line.every((p) => cells[cellIndex(p.row, p.col)] === disc);
        if (allMatch) {
          return { disc, line: line.map((p) => cellIndex(p.row, p.col)) };
        }
      }
    }
  }
  return null;
}

export function isBoardFull(cells: Array<Disc | null>): boolean {
  return cells.every((c) => c !== null);
}

export const FourInARowGame: Game<FourInARowG> = {
  name: "four-in-a-row",

  setup: (): FourInARowG => ({
    cells: Array(ROWS * COLS).fill(null),
    columnHeights: Array(COLS).fill(0),
    winner: null,
    winningLine: null,
  }),

  turn: {
    minMoves: 1,
    maxMoves: 1,
  },

  moves: {
    dropDisc: ({ G, ctx }, column: number) => {
      if (!Number.isInteger(column) || column < 0 || column >= COLS) {
        return INVALID_MOVE;
      }
      if (G.columnHeights[column] >= ROWS) {
        return INVALID_MOVE; // column full
      }

      const disc: Disc = ctx.currentPlayer === "0" ? "R" : "Y";
      const row = ROWS - 1 - G.columnHeights[column];

      const cells = G.cells.slice();
      cells[cellIndex(row, column)] = disc;
      const columnHeights = G.columnHeights.slice();
      columnHeights[column] = columnHeights[column] + 1;

      const result = findWinningLine(cells);

      return {
        ...G,
        cells,
        columnHeights,
        winner: result?.disc ?? null,
        winningLine: result?.line ?? null,
      };
    },
  },

  endIf: ({ G }) => {
    if (G.winner) {
      return { winner: G.winner };
    }
    if (isBoardFull(G.cells)) {
      return { draw: true };
    }
    return undefined;
  },
};
