// Headless runner for the Dots and Boxes boardgame.io Game - same
// pattern as lib/games/four-in-a-row/engine.ts (see that file's header
// comment for the full "why headless, not boardgame.io's own transport"
// rationale). Each API request reconstructs state from the persisted
// Supabase row, calls the pure `drawLine` function from ./game
// directly, and hands the result to the caller for persistence via
// apply_dots_and_boxes_move_result (migration 051_dots_and_boxes.sql).
//
// The one rule that's genuinely about turn order rather than board
// state - completing a box earns another turn - is decided here, not
// in game.ts, since the headless approach doesn't lean on
// boardgame.io's own turn/event system (see engine.ts in the
// four-in-a-row folder for why).

import { drawLine as pureDrawLine, isGameFull, createEmptyState, type Player, type LineType, type DotsAndBoxesG } from "./game";

export interface DotsAndBoxesState {
  h_lines: Array<Player | null>;
  v_lines: Array<Player | null>;
  box_owners: Array<Player | null>;
  scores: { R: number; Y: number };
  current_turn: Player;
  winner: Player | null;
  is_draw: boolean;
  game_over: boolean;
  r_player_id: string;
  y_player_id: string | null;
}

export function createInitialState(creatorId: string): DotsAndBoxesState {
  const empty = createEmptyState();
  return {
    h_lines: empty.hLines,
    v_lines: empty.vLines,
    box_owners: empty.boxOwners,
    scores: empty.scores,
    current_turn: "R",
    winner: null,
    is_draw: false,
    game_over: false,
    r_player_id: creatorId,
    y_player_id: null,
  };
}

export class DotsAndBoxesRulesError extends Error {}

export function applyDrawLine(
  state: DotsAndBoxesState,
  playerId: string,
  lineType: LineType,
  lineIndex: number,
): DotsAndBoxesState {
  if (state.game_over) {
    throw new DotsAndBoxesRulesError("This match has already ended");
  }

  const isR = state.r_player_id === playerId;
  const isY = state.y_player_id === playerId;
  if (!isR && !isY) {
    throw new DotsAndBoxesRulesError("You are not a participant in this match");
  }

  const mySeat: Player = isR ? "R" : "Y";
  if (state.current_turn !== mySeat) {
    throw new DotsAndBoxesRulesError("It's not your turn");
  }

  const G: DotsAndBoxesG = {
    hLines: state.h_lines,
    vLines: state.v_lines,
    boxOwners: state.box_owners,
    scores: state.scores,
  };

  let result: { state: DotsAndBoxesG; boxesCompleted: number };
  try {
    result = pureDrawLine(G, lineType, lineIndex, mySeat);
  } catch (err) {
    throw new DotsAndBoxesRulesError(err instanceof Error ? err.message : "Invalid move");
  }

  const { state: newG, boxesCompleted } = result;
  const full = isGameFull(newG);

  let winner: Player | null = null;
  let isDraw = false;
  if (full) {
    if (newG.scores.R > newG.scores.Y) winner = "R";
    else if (newG.scores.Y > newG.scores.R) winner = "Y";
    else isDraw = true;
  }

  // Completing at least one box earns another turn - the one genuinely
  // extra rule in this game. A player can chain several extra turns in
  // a row this way, which is correct Dots and Boxes behavior.
  const nextTurn: Player = boxesCompleted > 0 ? mySeat : mySeat === "R" ? "Y" : "R";

  return {
    h_lines: newG.hLines,
    v_lines: newG.vLines,
    box_owners: newG.boxOwners,
    scores: newG.scores,
    current_turn: full ? state.current_turn : nextTurn,
    winner,
    is_draw: isDraw,
    game_over: full,
    r_player_id: state.r_player_id,
    y_player_id: state.y_player_id,
  };
}
