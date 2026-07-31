import { ArcheryState, ArcheryShot } from "@/types/archery";

export const TARGET_RINGS = 10;
export const RING_WIDTH = 12; // Each ring is 12 pixels wide
export const TARGET_RADIUS = TARGET_RINGS * RING_WIDTH; // 120 pixels

export function calculateScore(finalX: number, finalY: number): number {
  const distance = Math.sqrt(finalX * finalX + finalY * finalY);
  
  if (distance > TARGET_RADIUS) return 0;

  // If distance is 0, score is 10.
  // If distance is 11, score is 10.
  // If distance is 12.5, score is 9.
  const ring = Math.floor(distance / RING_WIDTH);
  return Math.max(1, 10 - ring);
}

export function validateShot(
  state: ArcheryState,
  playerId: string,
  shot: ArcheryShot
): { valid: boolean; error?: string } {
  if (state.game_over) return { valid: false, error: "Game is over" };
  
  const expectedTurnId = state.current_turn === "A" ? state.a_player_id : state.b_player_id;
  if (playerId !== expectedTurnId) {
    return { valid: false, error: "Not your turn" };
  }

  // Basic sanity checks on the shot payload
  if (
    typeof shot.angle !== "number" ||
    typeof shot.power !== "number" ||
    typeof shot.finalX !== "number" ||
    typeof shot.finalY !== "number"
  ) {
    return { valid: false, error: "Invalid shot data" };
  }

  // The client sends the final coordinates. In a fully authoritative server, we would recalculate
  // the trajectory based on angle, power, and wind. For now, we trust the finalX/finalY provided
  // by the client but verify the score.
  
  const expectedScore = calculateScore(shot.finalX, shot.finalY);
  if (shot.score !== expectedScore) {
    // Optionally correct it, or reject
    // We'll trust our calculation over the client's payload.
  }

  return { valid: true };
}

export function generateWindAndDistance() {
  // Random wind between -5 and 5
  const windX = (Math.random() - 0.5) * 10;
  const windY = (Math.random() - 0.5) * 10;
  
  // Distance scalar, e.g. 1.0 to 2.5
  const targetDist = 1.0 + Math.random() * 1.5;

  return { windX, windY, targetDist };
}

export function applyShot(state: ArcheryState, shot: ArcheryShot): ArcheryState {
  const newState = { ...state };
  
  // Recalculate score securely
  shot.score = calculateScore(shot.finalX, shot.finalY);

  if (state.current_turn === "A") {
    newState.a_shots = [...state.a_shots, shot];
    newState.a_score += shot.score;
    // B's turn next, same round
    if (newState.b_player_id) {
        newState.current_turn = "B";
    }
  } else {
    newState.b_shots = [...state.b_shots, shot];
    newState.b_score += shot.score;
    // End of round
    newState.round += 1;
    newState.current_turn = "A";
    
    // Generate new wind/distance for the next round
    const { windX, windY, targetDist } = generateWindAndDistance();
    newState.wind_x = windX;
    newState.wind_y = windY;
    newState.target_dist = targetDist;
  }

  // Game over after 3 rounds (each player took 3 shots)
  if (newState.round > 3) {
    newState.game_over = true;
    if (newState.a_score > newState.b_score) {
      newState.winner = "A";
    } else if (newState.b_score > newState.a_score) {
      newState.winner = "B";
    } else {
      // Tie
      newState.winner = null; 
    }
  }

  return newState;
}
