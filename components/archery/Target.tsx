"use client";

import { useRef } from "react";
import { RigidBody, CylinderCollider, type CollisionEnterPayload } from "@react-three/rapier";
import { GAME_CONFIG } from "@/types/archery";
import { useArcheryStore } from "@/stores/archery-store";

const { targetPosition, targetRadius, ringRadii, ringPoints } = GAME_CONFIG;

// After this rotation (90deg about X), the cylinder's flat circular
// face - originally perpendicular to Y - ends up perpendicular to Z,
// i.e. lying in the local XY plane and facing the shooter. That's
// what makes `localContactPoint.x/.y` below directly usable as
// "horizontal/vertical offset from the target's center": no further
// projection math needed, the collider's local frame already *is*
// the target face's own plane.
const FACE_ROTATION: [number, number, number] = [Math.PI / 2, 0, 0];

function scoreFromOffset(x: number, y: number): { points: number; label: string } {
  const dist = Math.sqrt(x * x + y * y);
  if (dist > targetRadius) return { points: 0, label: "MISS" };
  for (let i = 0; i < ringRadii.length; i++) {
    if (dist <= targetRadius * ringRadii[i]) {
      return {
        points: ringPoints[i],
        label: ringPoints[i] === 10 ? "BULLSEYE" : `+${ringPoints[i]}`,
      };
    }
  }
  return { points: 1, label: "+1" };
}

export default function Target() {
  const addScore = useArcheryStore((s) => s.addScore);
  // An arrow can, in principle, generate more than one collision
  // event against the target (e.g. a graze followed by a proper
  // settle) - this tracks which rigid bodies have already been
  // scored so a single shaft can never award points twice. Keyed by
  // object identity (the rigid body reference itself stays stable for
  // that arrow's whole physics lifetime), not by re-render, so a
  // plain ref/Set is correct here rather than React state.
  const scoredBodies = useRef(new WeakSet<object>());

  function handleCollisionEnter(payload: CollisionEnterPayload) {
    const otherBody = payload.other.rigidBody;
    const isArrow = (payload.other.rigidBodyObject?.userData as { type?: string } | undefined)
      ?.type === "arrow";
    if (!otherBody || !isArrow) return;
    if (scoredBodies.current.has(otherBody)) return;
    scoredBodies.current.add(otherBody);

    // Prefer the real contact manifold - it's the exact point where
    // the arrow tip actually touched the target face, in the target
    // collider's own local space. `flipped` tells us whether the
    // manifold's "collider 1" is us (the target) or the other body;
    // grab whichever side corresponds to the target so the offset is
    // always relative to *our* center regardless of collision order.
    const manifold = payload.manifold;
    const contact = manifold.numContacts() > 0
      ? (payload.flipped ? manifold.localContactPoint2(0) : manifold.localContactPoint1(0))
      : null;

    // Fallback for the rare case a manifold has zero contact points
    // by the time this fires (very fast-moving thin colliders can
    // occasionally report an enter event a step after the deepest
    // penetration) - approximate using the arrow's own current
    // position relative to the target instead of failing to score.
    const localX = contact?.x ?? (otherBody.translation().x - targetPosition[0]);
    const localY = contact
      ? contact.y
      : otherBody.translation().y - targetPosition[1];

    const { points, label } = scoreFromOffset(localX, localY);
    addScore({ points, label, localX, localY });
  }

  return (
    <RigidBody
      type="fixed"
      position={targetPosition}
      colliders={false}
      onCollisionEnter={handleCollisionEnter}
    >
      <CylinderCollider args={[0.15, targetRadius]} rotation={FACE_ROTATION} />

      {/* Backing board */}
      <mesh rotation={FACE_ROTATION} receiveShadow castShadow>
        <cylinderGeometry args={[targetRadius, targetRadius, 0.3, 32]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.9} />
      </mesh>

      {/* Painted rings, largest/outermost first so each smaller disc
          draws on top - a cheap way to fake concentric rings with
          plain cylinder primitives instead of a ring texture. */}
      {ringRadii.map((frac, i) => (
        <mesh
          key={frac}
          rotation={FACE_ROTATION}
          position={[0, 0, 0.001 * (i + 1)]}
        >
          <cylinderGeometry args={[targetRadius * frac, targetRadius * frac, 0.02, 32]} />
          <meshStandardMaterial
            color={RING_COLORS[i]}
            roughness={0.8}
          />
        </mesh>
      ))}

      {/* Simple 4-leg ground stand */}
      {[
        [-0.55, -1.6, 0.35],
        [0.55, -1.6, 0.35],
        [-0.55, -1.6, -0.35],
        [0.55, -1.6, -0.35],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <boxGeometry args={[0.08, 1.9, 0.08]} />
          <meshStandardMaterial color="#4a2c17" roughness={0.9} />
        </mesh>
      ))}
    </RigidBody>
  );
}

// White outer ring down to a yellow/gold bullseye, matching the
// ringRadii/ringPoints ordering in GAME_CONFIG (outer to inner).
const RING_COLORS = ["#f4f1ea", "#1a1a1a", "#3d7dd6", "#3d7dd6", "#d6362e", "#f2c230"];
