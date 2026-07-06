// Dots and Boxes - rules engine
//
// Same architecture as Four in a Row (see lib/games/four-in-a-row/game.ts
// for the full rationale): a real boardgame.io `Game` object is the
// authored rules authority, run headlessly per-request via engine.ts in
// this folder rather than through boardgame.io's own multiplayer
// transport, so the existing Supabase-realtime path stays the single
// source of truth for every game.
//
// Grid: 4x4 boxes (5x5 dots). A line is either horizontal or vertical:
//  - hLines: 5 rows x 4 cols = 20 lines, index = row*4 + col. Line i
//    joins dot(row,col) to dot(row,col+1).
//  - vLines: 4 rows x 5 cols = 20 lines, index = row*5 + col. Line i
//    joins dot(row,col) to dot(row+1,col).
// Box (row,col), 0<=row,col<4, is bounded by hLines[row*4+col] (top),
// hLines[(row+1)*4+col] (bottom), vLines[row*5+col] (left),
// vLines[row*5+col+1] (right).

import type { Game } from "boardgame.io";
import { INVALID_MOVE } from "boardgame.io/core";

export const BOX_ROWS = 4;
export const BOX_COLS = 4;
export const H_LINES = (BOX_ROWS + 1) * BOX_COLS; // 20
export const V_LINES = BOX_ROWS * (BOX_COLS + 1); // 20
export const TOTAL_BOXES = BOX_ROWS * BOX_COLS; // 16

export type Player = "R" | "Y";
export type LineType = "h" | "v";

export interface DotsAndBoxesG {
  hLines: Array<Player | null>;
  vLines: Array<Player | null>;
  boxOwners: Array<Player | null>;
  scores: { R: number; Y: number };
}

function boxSides(row: number, col: number) {
  return {
    top: row * BOX_COLS + col,
    bottom: (row + 1) * BOX_COLS + col,
    left: row * (BOX_COLS + 1) + col,
    right: row * (BOX_COLS + 1) + col + 1,
  };
}

// Which box(es) a given line touches - at most 2, so completing a move
// only ever needs to re-check 1-2 boxes, not scan the whole board.
function boxesTouchingHLine(index: number): Array<{ row: number; col: number }> {
  const row = Math.floor(index / BOX_COLS);
  const col = index % BOX_COLS;
  const boxes: Array<{ row: number; col: number }> = [];
  if (row > 0) boxes.push({ row: row - 1, col });
  if (row < BOX_ROWS) boxes.push({ row, col });
  return boxes;
}

function boxesTouchingVLine(index: number): Array<{ row: number; col: number }> {
  const row = Math.floor(index / (BOX_COLS + 1));
  const col = index % (BOX_COLS + 1);
  const boxes: Array<{ row: number; col: number }> = [];
  if (col > 0) boxes.push({ row, col: col - 1 });
  if (col < BOX_COLS) boxes.push({ row, col });
  return boxes;
}

function isBoxComplete(G: DotsAndBoxesG, row: number, col: number): boolean {
  const { top, bottom, left, right } = boxSides(row, col);
  return !!G.hLines[top] && !!G.hLines[bottom] && !!G.vLines[left] && !!G.vLines[right];
}

export function createEmptyState(): DotsAndBoxesG {
  return {
    hLines: Array(H_LINES).fill(null),
    vLines: Array(V_LINES).fill(null),
    boxOwners: Array(TOTAL_BOXES).fill(null),
    scores: { R: 0, Y: 0 },
  };
}

/** Draws one line for `player`. Returns the updated state and how many
 *  new boxes this single move completed (0, 1, or 2 - a line can be the
 *  last side of two boxes at once). The caller decides whether
 *  completing a box earns another turn - that's a turn-order rule, not
 *  a board-state rule, so it lives in engine.ts, not here. */
export function drawLine(
  G: DotsAndBoxesG,
  lineType: LineType,
  lineIndex: number,
  player: Player,
): { state: DotsAndBoxesG; boxesCompleted: number } {
  const lines = lineType === "h" ? G.hLines : G.vLines;
  if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= lines.length) {
    throw new Error("Invalid line");
  }
  if (lines[lineIndex] !== null) {
    throw new Error("That line is already drawn");
  }

  const hLines = lineType === "h" ? [...G.hLines] : G.hLines;
  const vLines = lineType === "v" ? [...G.vLines] : G.vLines;
  if (lineType === "h") hLines[lineIndex] = player;
  else vLines[lineIndex] = player;

  const nextG: DotsAndBoxesG = { hLines, vLines, boxOwners: [...G.boxOwners], scores: { ...G.scores } };
  const candidates = lineType === "h" ? boxesTouchingHLine(lineIndex) : boxesTouchingVLine(lineIndex);

  let boxesCompleted = 0;
  for (const { row, col } of candidates) {
    const boxIndex = row * BOX_COLS + col;
    if (nextG.boxOwners[boxIndex] === null && isBoxComplete(nextG, row, col)) {
      nextG.boxOwners[boxIndex] = player;
      nextG.scores[player] += 1;
      boxesCompleted += 1;
    }
  }

  return { state: nextG, boxesCompleted };
}

export function isGameFull(G: DotsAndBoxesG): boolean {
  return G.hLines.every((l) => l !== null) && G.vLines.every((l) => l !== null);
}

export const DotsAndBoxesGame: Game<DotsAndBoxesG> = {
  name: "dots-and-boxes",

  setup: (): DotsAndBoxesG => createEmptyState(),

  moves: {
    drawLine: ({ G, ctx }, lineType: LineType, lineIndex: number) => {
      const player: Player = ctx.currentPlayer === "0" ? "R" : "Y";
      try {
        const { state } = drawLine(G, lineType, lineIndex, player);
        return state;
      } catch {
        return INVALID_MOVE;
      }
    },
  },

  endIf: ({ G }) => {
    if (isGameFull(G)) {
      if (G.scores.R > G.scores.Y) return { winner: "R" };
      if (G.scores.Y > G.scores.R) return { winner: "Y" };
      return { draw: true };
    }
    return undefined;
  },
};
