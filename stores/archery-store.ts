import { create } from "zustand";
import type { ImpactResult, WindVector } from "@/types/archery";
import { GAME_CONFIG } from "@/types/archery";

/**
 * Deliberately small: this store only holds things the HTML overlay
 * (score, arrows left, wind readout) or cross-component orchestration
 * (is an arrow currently in flight, so input can be gated) actually
 * need to read reactively. Per-frame numbers - drag position, pull
 * power, an arrow's live velocity - never touch this store; they live
 * in refs inside the 3D tree instead (see hooks/useAimControls.ts and
 * Arrow.tsx). Putting those in Zustand too would re-render every
 * subscribed component on every pointermove/physics tick, which is
 * exactly the perf trap this split avoids.
 */
interface ArcheryStore {
  score: number;
  arrowsLeft: number;
  totalArrows: number;
  currentWind: WindVector;
  /** True from the moment an arrow is released until it comes to
   * rest/is scored - gates new aim input so you can't draw a second
   * shot while one is still in the air. */
  isFlying: boolean;
  /** Last impact, purely for the HUD's transient "+10" style toast.
   * Not used for scoring logic itself (that happens once, in
   * Target's collision handler, and calls addScore directly). */
  lastImpact: ImpactResult | null;

  addScore: (impact: ImpactResult) => void;
  startFlight: () => void;
  endFlight: () => void;
  rollWind: () => void;
  resetGame: (totalArrows?: number) => void;
}

function randomWind(): WindVector {
  // Bounded to a range that's noticeable but rarely unfair - +/-4 m/s
  // crosswind, a much smaller head/tail-wind component since that
  // mostly just nudges arrival timing rather than aim.
  return {
    x: (Math.random() * 2 - 1) * 4,
    z: (Math.random() * 2 - 1) * 1.2,
  };
}

export const useArcheryStore = create<ArcheryStore>((set) => ({
  score: 0,
  arrowsLeft: GAME_CONFIG.defaultArrows,
  totalArrows: GAME_CONFIG.defaultArrows,
  currentWind: randomWind(),
  isFlying: false,
  lastImpact: null,

  addScore: (impact) =>
    set((s) => ({ score: s.score + impact.points, lastImpact: impact })),

  // Called the moment an arrow is released (not when it lands) - this
  // is what decrements the arrow count and gates further input, kept
  // separate from endFlight so "arrows left" ticks down immediately
  // on release, matching every reference archery game's feel, instead
  // of waiting for the flight animation to finish.
  startFlight: () =>
    set((s) => ({
      arrowsLeft: Math.max(0, s.arrowsLeft - 1),
      isFlying: true,
    })),

  endFlight: () => set({ isFlying: false }),

  rollWind: () => set({ currentWind: randomWind() }),

  resetGame: (totalArrows = GAME_CONFIG.defaultArrows) =>
    set({
      score: 0,
      arrowsLeft: totalArrows,
      totalArrows,
      currentWind: randomWind(),
      isFlying: false,
      lastImpact: null,
    }),
}));
