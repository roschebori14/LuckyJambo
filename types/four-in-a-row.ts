export type FourInARowDisc = "R" | "Y";

export interface FourInARowState {
  cells: Array<FourInARowDisc | null>;

  column_heights: number[];

  current_turn: FourInARowDisc;

  winner: FourInARowDisc | null;

  winning_line: number[] | null;

  is_draw: boolean;

  game_over: boolean;

  r_player_id: string;

  y_player_id: string | null;
}
