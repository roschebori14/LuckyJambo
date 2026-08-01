// Single source of truth for arrow flight. Imported by both the
// client's Phaser board (to draw the aim preview and play back the
// actual flight) and the server's engine.ts (to independently derive
// the landing point and score). Neither side trusts a client-reported
// final position - both run this function and, being the same
// deterministic math, always agree.
//
// This is deliberately NOT the same tradeoff pool made
// (supabase/migrations/064_eight_ball_pool.sql): pool's multi-ball
// collision physics is genuinely expensive to replay server-side, so
// it settled for plausibility-checking the client's reported result.
// A single arrow's flight is one projectile with three inputs
// (power, angle, wind) - cheap enough to compute authoritatively on
// the server every time, so there's no reason to settle for less here.

export interface TrajectoryPoint {
  x: number;
  y: number;
  z: number;
}

export interface TrajectoryResult {
  path: TrajectoryPoint[]; // sampled points for animating/previewing the flight
  finalX: number;          // landing position relative to target center
  finalY: number;
  hit: boolean;             // false if the arrow never reached the target plane (fell short)
}

export const GRAVITY = 0.5;
export const LAUNCH_Y = -100;
export const LAUNCH_Z = 50;
export const MAX_POWER = 60;
export const MIN_RELEASE_POWER = 15; // below this, a release is treated as a cancelled aim, not a shot
export const TARGET_Z_BASE = 2000;

// Tuned so the wind's effect is learnable, matching the rule of thumb
// GamePigeon Archery players actually use ("roughly 1 wind unit of
// drift per ring") rather than an arbitrary-feeling constant - see
// RING_WIDTH in engine.ts for how this lines up with scoring.
export const WIND_DRIFT_PER_FRAME = 0.05;

/** How far back the target sits this round, in world Z units. */
export function targetZFor(targetDist: number): number {
  return TARGET_Z_BASE * Math.max(0.5, targetDist);
}

/**
 * Simulates one arrow's flight from launch to the target plane (or
 * until it's clearly missed - fallen well short, or exceeded a hard
 * frame cap so a pathological input can never loop unbounded).
 *
 * angleX/angleY are the same drag-derived aim units the board already
 * produces; power is pre-clamped defensively here regardless of what
 * the caller passes, since this same function runs directly against
 * client-supplied input on the server.
 */
export function simulateTrajectory(
  power: number,
  angleX: number,
  angleY: number,
  windX: number,
  targetDist: number
): TrajectoryResult {
  const clampedPower = Math.max(0, Math.min(MAX_POWER, power));
  const targetZ = targetZFor(targetDist);
  const windForceX = windX * WIND_DRIFT_PER_FRAME;

  let x = 0;
  let y = LAUNCH_Y;
  let z = LAUNCH_Z;
  let vx = angleX * clampedPower;
  let vy = angleY * clampedPower;
  let vz = clampedPower * 2.5;

  const path: TrajectoryPoint[] = [{ x, y, z }];
  const MAX_FRAMES = 2000; // safety cap - a legitimate shot resolves in well under 100 frames
  let frames = 0;
  let reachedTarget = false;

  while (frames < MAX_FRAMES) {
    x += vx;
    y += vy;
    z += vz;
    vy -= GRAVITY;
    vx += windForceX;
    frames++;

    if (frames % 2 === 0) path.push({ x, y, z });

    if (z >= targetZ) {
      reachedTarget = true;
      break;
    }
    if (y < -1200) break; // fell out of the sky well short - no point simulating further
  }

  return {
    path,
    finalX: reachedTarget ? x : 9999,
    finalY: reachedTarget ? -(y - 50) : 9999,
    hit: reachedTarget,
  };
}
