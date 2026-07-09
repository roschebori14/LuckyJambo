export type BallType = "cue" | "solid" | "stripe" | "eight";
export type PlayerSeat = "A" | "B";
export type PoolPhase = "break" | "open" | "assigned" | "game_over";

export interface PoolBall {
  id: number; // 0 = cue, 1-7 solids, 8 = eight ball, 9-15 stripes
  type: BallType;
  x: number;
  y: number;
  pocketed: boolean;
}

export interface PoolState {
  game_type: "eight-ball-pool";
  a_player_id: string;
  b_player_id: string | null;
  balls: PoolBall[];
  current_turn: PlayerSeat;
  phase: PoolPhase;
  /** Which ball type each seat is shooting - null until assigned
   *  (table "open" after the break). */
  player_type: { A: BallType | null; B: BallType | null };
  ball_in_hand: PlayerSeat | null;
  winner: PlayerSeat | null;
  game_over: boolean;
  last_foul_reason: string | null;
  shot_number: number;
}

/** What a client reports after simulating a shot locally. */
export interface ShotSubmission {
  final_positions: { id: number; x: number; y: number; pocketed: boolean }[];
  first_contact_ball_id: number | null;
  cue_pocketed: boolean;
}

// Standard table proportions, playing-surface coordinate space (not
// pixels - the board component scales this to whatever canvas size it
// renders at). 2:1 ratio.
export const TABLE_WIDTH = 800;
export const TABLE_HEIGHT = 400;
export const BALL_RADIUS = 11;
export const POCKET_RADIUS = 22;

export const POCKETS: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: TABLE_WIDTH / 2, y: -6 },
  { x: TABLE_WIDTH, y: 0 },
  { x: 0, y: TABLE_HEIGHT },
  { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT + 6 },
  { x: TABLE_WIDTH, y: TABLE_HEIGHT },
];
