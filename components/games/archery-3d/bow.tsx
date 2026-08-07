"use client";

import { useRef, type RefObject, type Ref } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AimState } from "@/hooks/use-archery-3d-aim";

interface BowProps {
  aimRef: RefObject<AimState>;
  /** Hide the nocked arrow while a physics arrow is actually in
   * flight - otherwise you'd see two arrows (the static nocked one
   * plus the live one from experience.tsx) between release and the
   * next draw. */
  hasArrowNocked: boolean;
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

// Nocked-arrow rest length/offset, in the bow's own local space -
// kept in sync with the string's rest position (pullZ at power=0)
// and pointing back through the grip toward the shooter along +Z,
// which is "backward" in this bow's local frame (see the string
// geometry below - power pulls the midpoint toward +Z).
const ARROW_LENGTH = 0.9;
const ARROW_REST_Z = 0.05;

export default function Bow({ aimRef, hasArrowNocked }: BowProps) {
  const groupRef = useRef<THREE.Group>(null);
  const stringRef = useRef<THREE.Line>(null);
  const stringGeomRef = useRef<THREE.BufferGeometry>(null);
  const arrowRef = useRef<THREE.Group>(null);

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
    const pullZ = ARROW_REST_Z + aim.power * 0.42;
    const geom = stringGeomRef.current;
    if (geom) {
      const mid = new THREE.Vector3(0, -0.02, pullZ);
      geom.setFromPoints([topNock, mid, bottomNock]);
    }

    // The nocked arrow's tail rides the string's midpoint, its head
    // stays fixed near the front of the bow (arrows don't get
    // shorter as you draw - the whole shaft slides backward with the
    // string). Nudging it up slightly onto the grip's arrow rest and
    // out to +X keeps it from clipping through the riser/torus limbs.
    const arrow = arrowRef.current;
    if (arrow) {
      const headZ = ARROW_REST_Z - ARROW_LENGTH / 2;
      const tailZ = mid_z(pullZ);
      arrow.position.set(0.045, 0.05, (headZ + tailZ) / 2);
      // Arrow mesh geometry is authored tip-first along local +Y (see
      // arrow.tsx); rotating -90deg about X points that same +Y
      // convention down the bow's local +Z draw axis instead, so the
      // nocked arrow and the fired arrow always share one "forward"
      // definition and never visually snap into a different pose on
      // release.
      arrow.rotation.set(-Math.PI / 2, 0, 0);
      const length = tailZ - headZ;
      arrow.scale.set(1, length / ARROW_LENGTH, 1);
    }
  });

  function mid_z(pullZ: number) {
    return pullZ;
  }

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

      {/* Nocked arrow - same shaft/head/fletching styling as the
          fired Arrow component, so there's no visible swap on
          release. Scale (not geometry) stretches it to bridge from
          the fixed head position to the string's current pull point,
          which is cheap and avoids rebuilding geometry every frame. */}
      {hasArrowNocked && (
        <group ref={arrowRef} visible={hasArrowNocked}>
          <mesh castShadow>
            <cylinderGeometry args={[0.012, 0.012, ARROW_LENGTH, 8]} />
            <meshStandardMaterial color="#caa472" roughness={0.6} />
          </mesh>
          <mesh position={[0, ARROW_LENGTH / 2, 0]} castShadow>
            <coneGeometry args={[0.025, 0.12, 8]} />
            <meshStandardMaterial
              color="#8a8a8a"
              metalness={0.6}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, -ARROW_LENGTH / 2 + 0.06, 0]}>
            <coneGeometry args={[0.05, 0.14, 4]} />
            <meshStandardMaterial color="#d1483a" roughness={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}
