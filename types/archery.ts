/**
 * Shared types for the archery game. Kept framework-agnostic (no
 * Three.js/Rapier imports) so the Zustand store and the HTML overlay
 * can both depend on this file without pulling in WebGL-only code -
 * that's what keeps the store safe to import from a server component
 * or during SSR, even though the 3D tree itself never renders there.
 */

/** Horizontal wind vector, in the same world units the arrow's
 * velocity is measured in (roughly m/s). `x` is left(-)/right(+)
 * crosswind, `z` is a head/tail-wind component along the shooting
 * lane. There's no `y` - wind doesn't push straight up/down here,
 * gravity already owns the vertical axis. */
export interface WindVector {
  x: number;
  z: number;
}

/** Result of a single arrow's impact, used both to update score and
 * to drive the "+10" / "MISS" style HUD callout. */
export interface ImpactResult {
  points: number;
  label: string;
  /** Hit position on the target face, relative to its center, in the
   * target's own local space (meters). Null for a clean miss that
   * never touched the target at all. */
  localX: number | null;
  localY: number | null;
}

export const GAME_CONFIG = {
  defaultArrows: 5,
  targetPosition: [0, 1.6, -22] as [number, number, number],
  targetRadius: 1.1,
  /** Ring boundaries as fractions of targetRadius, outer to inner.
   * A hit inside ring[i]'s radius but outside ring[i+1]'s scores
   * `ringPoints[i]`. */
  ringRadii: [1.0, 0.8, 0.6, 0.42, 0.26, 0.1],
  ringPoints: [1, 3, 5, 7, 9, 10],
} as const;
