import * as THREE from "three";

/**
 * Single source of truth for "which way is this shot currently
 * aimed", given normalized drag deltas (drag pixels / MAX_DRAG_PX,
 * the same units useAimControls hands to onFire). Previously this
 * yaw/pitch/direction math lived inline in experience.tsx's
 * handleFire only - fine while it had one caller, but AimCamera and
 * Reticle both need the *exact* same mapping (not just a visually
 * similar one) or the sight picture and the true trajectory will
 * quietly disagree. Pulling it out here means all three consumers
 * share one implementation instead of three copies that could drift.
 *
 * dx/dy are the same slingshot-style inverse-drag inputs used
 * everywhere else in this codebase: drag down-and-right pulls the
 * shot up-and-left. See the comment in experience.tsx's old
 * handleFire for why yaw gets negated.
 */
export function computeAimDirection(dx: number, dy: number): THREE.Vector3 {
  const yaw = THREE.MathUtils.clamp(dx, -0.6, 0.6);
  const pitch = 0.12 + THREE.MathUtils.clamp(dy * 0.18, -0.05, 0.25);
  return new THREE.Vector3(-yaw, pitch, -1).normalize();
}
