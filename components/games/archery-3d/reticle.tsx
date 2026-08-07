"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { MAX_DRAG_PX, type AimState } from "@/hooks/use-archery-3d-aim";
import { computeAimDirection } from "@/lib/archery-aim";

interface ReticleProps {
  aimRef: RefObject<AimState>;
  /** World-space point the aim direction is cast from - pass the same
   * nock/bow position used for the actual arrow launch so the
   * reticle lines up with reality rather than an approximation from
   * the camera's own (different) position. */
  origin: [number, number, number];
}

// How far downrange to project the reticle - arbitrary (the reticle
// only needs to be *on* the aim ray, not at any particular point
// along it, since it's always rendered billboarded toward the
// camera), just far enough that it reads as "out on the range" and
// not sitting awkwardly close to the bow.
const RETICLE_DISTANCE = 18;

export default function Reticle({ aimRef, origin }: ReticleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const originVec = useRef(new THREE.Vector3(...origin));
  const dir = useRef(new THREE.Vector3());

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const aim = aimRef.current;

    const dx = aim.dragX / MAX_DRAG_PX;
    const dy = aim.dragY / MAX_DRAG_PX;
    dir.current.copy(computeAimDirection(dx, dy));
    group.position
      .copy(originVec.current)
      .addScaledVector(dir.current, RETICLE_DISTANCE);

    // Direct DOM mutation instead of React state - matches the "no
    // setState in a per-frame path" rule the rest of the codebase
    // follows (see use-archery-3d-aim.ts's top comment). Full
    // opacity while actively drawing, a faint resting dot otherwise,
    // so the reticle reads as "live" only once you're actually
    // pulling the string back.
    const el = wrapperRef.current;
    if (el) {
      el.style.opacity = aim.isDragging ? "1" : String(0.3 + aim.power * 0.4);
    }
  });

  return (
    <group ref={groupRef}>
      <Html
        center
        zIndexRange={[10, 0]}
        occlude={false}
        style={{ pointerEvents: "none" }}
      >
        <div
          ref={wrapperRef}
          className="relative h-8 w-8 opacity-30 transition-none"
        >
          <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#e8c877]" />
          <div className="absolute left-1/2 top-1/2 h-[2px] w-3.5 -translate-x-1/2 -translate-y-1/2 bg-[#e8c877]" />
          <div className="absolute left-1/2 top-1/2 h-3.5 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-[#e8c877]" />
        </div>
      </Html>
    </group>
  );
}
