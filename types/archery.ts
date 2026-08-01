export type ArcheryPhase = "aiming" | "shooting" | "game_over";

/** What the client sends when releasing a shot - aim only. The server
 *  (lib/games/archery/engine.ts + physics.ts) is the sole authority
 *  on where that aim actually lands; the client never reports a
 *  position or score for its own shot. */
export interface ArcheryShotInput {
  angleX: number;
  angleY: number;
  power: number; // 0 to MAX_POWER (physics.ts), not a 0-1 fraction
}

/** A resolved, already-scored shot as stored in game_state - the
 *  server's own record of what happened, not something a client ever
 *  constructs directly. */
export interface ArcheryShot {
  playerId: string;
  angleX: number;
  angleY: number;
  power: number;
  windX: number;      // the wind this shot was actually resolved against
  targetDist: number;  // the distance this shot was actually resolved against
  finalX: number;      // landing position relative to target center (0,0)
  finalY: number;
  score: number;
}

export interface ArcheryState {
  game_type: "archery";
  a_player_id: string;
  b_player_id: string | null;
  current_turn: "A" | "B";

  // Game progresses in rounds. A round consists of both players
  // shooting once. Game lasts 3 rounds (see engine.ts's applyShot).
  round: number;

  // Accumulated scores
  a_score: number;
  b_score: number;

  // History of shots
  a_shots: ArcheryShot[];
  b_shots: ArcheryShot[];

  // Wind for the current round - a single horizontal crosswind value.
  // There's deliberately no vertical wind component: archery games in
  // this genre (Archery King, GamePigeon Archery) only ever show a
  // single crosswind indicator, and a Y-axis wind has no intuitive
  // on-screen representation a player could actually aim against.
  wind_x: number;

  // Distance scalar for the current round (physics.ts's targetZFor
  // multiplies TARGET_Z_BASE by this).
  target_dist: number;

  winner: "A" | "B" | null;
  game_over: boolean;
}
