export type DotsAndBoxesPlayer = "R" | "Y";

export interface DotsAndBoxesState {
  h_lines: Array<DotsAndBoxesPlayer | null>;

  v_lines: Array<DotsAndBoxesPlayer | null>;

  box_owners: Array<DotsAndBoxesPlayer | null>;

  scores: { R: number; Y: number };

  current_turn: DotsAndBoxesPlayer;

  winner: DotsAndBoxesPlayer | null;

  is_draw: boolean;

  game_over: boolean;

  r_player_id: string;

  y_player_id: string | null;
}
