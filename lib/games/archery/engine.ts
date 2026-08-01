import { ArcheryState, ArcheryShot, ArcheryShotInput } from "@/types/archery";
import { simulateTrajectory, MAX_POWER, MIN_RELEASE_POWER } from "./physics";

export const TARGET_RINGS = 10;
export const RING_WIDTH = 12; // Each ring is 12 pixels wide
export const TARGET_RADIUS = TARGET_RINGS * RING_WIDTH; // 120 pixels

export function calculateScore(finalX: number, finalY: number): number {
  const distance = Math.sqrt(finalX * finalX + finalY * finalY);

  if (distance > TARGET_RADIUS) return 0;

  const ring = Math.floor(distance / RING_WIDTH);
  return Math.max(1, 10 - ring);
}

export function validateShotInput(
  state: ArcheryState,
  playerId: string,
  input: ArcheryShotInput
): { valid: boolean; error?: string } {
  if (state.game_over) return { valid: false, error: "Game is over" };

  const expectedTurnId = state.current_turn === "A" ? state.a_player_id : state.b_player_id;
  if (playerId !== expectedTurnId) {
    return { valid: false, error: "Not your turn" };
  }

  if (
    typeof input.angleX !== "number" ||
    typeof input.angleY !== "number" ||
    typeof input.power !== "number" ||
    !Number.isFinite(input.angleX) ||
    !Number.isFinite(input.angleY) ||
    !Number.isFinite(input.power)
  ) {
    return { valid: false, error: "Invalid shot input" };
  }

  // Loose sanity bounds - not the scoring itself (simulateTrajectory
  // clamps power on its own regardless), just enough to reject inputs
  // no legitimate drag gesture could ever produce, e.g. a direct API
  // call with power: 999999 or angleX: NaN-adjacent garbage.
  if (input.power < 0 || input.power > MAX_POWER * 1.5) {
    return { valid: false, error: "Power out of range" };
  }
  if (Math.abs(input.angleX) > 5 || Math.abs(input.angleY) > 5) {
    return { valid: false, error: "Angle out of range" };
  }

  return { valid: true };
}

export function generateWindAndDistance(round: number) {
  // Wind between -3 and 3 (a single horizontal crosswind value -
  // see types/archery.ts for why there's no vertical component).
  const windX = (Math.random() - 0.5) * 6;

  // Distance ramps up round over round (1.0 -> ~1.6 by round 3),
  // same idea as Archery King moving the target back after each shot,
  // plus a little randomness so it's not perfectly predictable.
  const targetDist = 1.0 + (round - 1) * 0.25 + Math.random() * 0.2;

  return { windX, targetDist };
}

/**
 * Resolves one shot authoritatively: re-runs the exact same
 * trajectory simulation the client used to animate the shot, using
 * the wind/distance the server itself generated for this round - the
 * client only ever supplied the aim inputs (angleX, angleY, power).
 * There is no client-reported landing position or score anywhere in
 * this path.
 */
export function applyShot(
  state: ArcheryState,
  playerId: string,
  input: ArcheryShotInput
): ArcheryState {
  const newState: ArcheryState = { ...state };

  const power = Math.max(0, Math.min(MAX_POWER, input.power));
  const result =
    power < MIN_RELEASE_POWER
      ? { finalX: 9999, finalY: 9999, hit: false } // cancelled/too-weak release scores as a miss, mirrors the board's own release threshold
      : simulateTrajectory(power, input.angleX, input.angleY, state.wind_x, state.target_dist);

  const score = result.hit ? calculateScore(result.finalX, result.finalY) : 0;

  const shot: ArcheryShot = {
    playerId,
    angleX: input.angleX,
    angleY: input.angleY,
    power,
    windX: state.wind_x,
    targetDist: state.target_dist,
    finalX: result.finalX,
    finalY: result.finalY,
    score,
  };

  if (state.current_turn === "A") {
    newState.a_shots = [...state.a_shots, shot];
    newState.a_score += shot.score;
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
    const { windX, targetDist } = generateWindAndDistance(newState.round);
    newState.wind_x = windX;
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
      newState.winner = null;
    }
  }

  return newState;
}
