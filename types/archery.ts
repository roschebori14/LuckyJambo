export type ArcheryPhase = "aiming" | "shooting" | "game_over";

/**
 * What the client actually has agency over: the raw aim gesture. This
 * is all that ever gets sent to the server - never a landing position
 * or a score. Those are derived, not reported (see lib/games/archery/
 * physics.ts and engine.ts's applyShot).
 */
export interface ArcheryShotInput {
  angleX: number; // horizontal aim, from left/right drag
  angleY: number; // vertical aim, from up/down drag
  power: number;  // 0 to MAX_POWER (see physics.ts), from pull-back distance
}

/** A fully-resolved shot, as stored in match history. */
export interface ArcheryShot extends ArcheryShotInput {
  playerId: string;
  windX: number;       // the wind that was in effect for this shot
  targetDist: number;  // the distance multiplier that was in effect
  finalX: number;      // server-computed landing position, relative to target center
  finalY: number;
  score: number;        // server-computed
}

export interface ArcheryState {
  game_type: "archery";
  a_player_id: string;
  b_player_id: string | null;
  current_turn: "A" | "B";
  
  // Game progresses in rounds. A round consists of both players shooting once.
  // Game typically lasts 3 rounds.
  round: number; 
  
  // Accumulated scores
  a_score: number;
  b_score: number;
  
  // History of shots
  a_shots: ArcheryShot[];
  b_shots: ArcheryShot[];
  
  // Wind for the current round - horizontal only (a vertical component
  // isn't something a player can read or compensate for, so it was
  // never actually fair; every reference archery game uses a single
  // horizontal crosswind value for exactly this reason).
  wind_x: number;
  
  // Distance multiplier for the current round (1.0 = base distance).
  // Escalates round to round, same as Archery King moving the target
  // back after each shot - this makes later rounds meaningfully harder
  // instead of every round playing identically.
  target_dist: number;

  winner: string | null;
  game_over: boolean;
}
