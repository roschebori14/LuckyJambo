"use client";

import { useRef, type RefObject, type Ref } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AimState } from "@/hooks/use-archery-3d-aim";

interface BowProps {
  aimRef: RefObject<AimState>;
}

/**
 * Purely presentational - a bow built from primitives (a bent torus
 * arc for the limbs, a box grip, a line-ish string) that leans/sways
 * and pulls back to visualize the live drag, entirely driven by
 * reading `aimRef.current` inside useFrame. No React state anywhere
 * in this component: the whole point of threading a ref in from
 * useAimControls is that a 60fps drag never triggers React's render
 * cycle, only Three.js object mutations.
 */
const BASE_POSITION = new THREE.Vector3(0.55, 1.35, 4.4);

export default function Bow({ aimRef }: BowProps) {
  const groupRef = useRef<THREE.Group>(null);
  const stringRef = useRef<THREE.Line>(null);
  const stringGeomRef = useRef<THREE.BufferGeometry>(null);

  // Static string endpoints (top/bottom nock) in the bow's local
  // space - only the middle point moves as the string is drawn back.
  const topNock = new THREE.Vector3(0, 0.62, 0.05);
  const bottomNock = new THREE.Vector3(0, -0.62, 0.05);

  useFrame(() => {
    const aim = aimRef.current;
    const group = groupRef.current;
    if (!group) return;

    // Visual sway/lean toward the drag direction, and a slight
    // backward push (positive Z, toward the camera) that reads as
    // "drawing the string toward your face" as power increases.
    // All positional lerps target BASE_POSITION plus an offset -
    // lerping toward the offset alone (dropping the base) would walk
    // the whole bow away from its resting spot in front of the
    // camera and toward the world origin every frame.
    const swayX = THREE.MathUtils.clamp(aim.dragX * 0.002, -0.35, 0.35);
    const swayY = THREE.MathUtils.clamp(-aim.dragY * 0.0015, -0.2, 0.25);
    group.rotation.z = THREE.MathUtils.lerp(
      group.rotation.z,
      -swayX * 0.6,
      0.25,
    );
    group.rotation.x = THREE.MathUtils.lerp(
      group.rotation.x,
      swayY * 0.3,
      0.25,
    );
    group.position.x = THREE.MathUtils.lerp(
      group.position.x,
      BASE_POSITION.x + swayX * 0.3,
      0.25,
    );
    group.position.z = THREE.MathUtils.lerp(
      group.position.z,
      BASE_POSITION.z + aim.power * 0.25,
      0.25,
    );

    // Redraw the string with its midpoint pulled back along +Z,
    // proportional to power - a cheap way to sell "the string is
    // under tension" without a skinned/animated asset.
    const geom = stringGeomRef.current;
    if (geom) {
      const pullZ = 0.05 + aim.power * 0.42;
      const mid = new THREE.Vector3(0, -0.02, pullZ);
      geom.setFromPoints([topNock, mid, bottomNock]);
    }
  });

  return (
    <group ref={groupRef} position={BASE_POSITION.toArray()}>
      {/* Limbs: two bent tori standing in for a recurve bow's curve,
          built from primitives only per the prototyping constraint. */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[0, 0.35, 0]} castShadow>
        <torusGeometry args={[0.32, 0.025, 8, 16, Math.PI * 0.9]} />
        <meshStandardMaterial color="#6b4326" roughness={0.6} />
      </mesh>
      <mesh
        rotation={[0, Math.PI / 2, Math.PI]}
        position={[0, -0.35, 0]}
        castShadow
      >
        <torusGeometry args={[0.32, 0.025, 8, 16, Math.PI * 0.9]} />
        <meshStandardMaterial color="#6b4326" roughness={0.6} />
      </mesh>
      {/* Grip */}
      <mesh castShadow>
        <cylinderGeometry args={[0.03, 0.035, 0.34, 10]} />
        <meshStandardMaterial color="#3a2415" roughness={0.7} />
      </mesh>
      {/* String - R3F's <line> intrinsic and the DOM SVGLineElement
          type collide at the JSX.IntrinsicElements level; casting the
          ref explicitly is the reliable fix (a `@ts-expect-error`
          comment inside a JSX `{}` block isn't recognized as a
          suppression directive by tsc). */}
      <line ref={stringRef as unknown as Ref<SVGLineElement>}>
        <bufferGeometry ref={stringGeomRef} />
        <lineBasicMaterial color="#e8e0d0" />
      </line>
    </group>
  );
}
