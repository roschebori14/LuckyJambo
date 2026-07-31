export type ArcheryPhase = "aiming" | "shooting" | "game_over";

export interface ArcheryShot {
  playerId: string;
  angle: number;       // radians (upwards from horizon)
  power: number;       // 0 to 1
  windX: number;       // the wind applied to this shot
  windY: number;
  finalX: number;      // coordinates relative to target center (0,0)
  finalY: number;
  score: number;
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
  
  // Wind for the current round (or turn)
  wind_x: number;
  wind_y: number;
  
  // Distance for current round
  target_dist: number;

  winner: string | null;
  game_over: boolean;
}
