"use client";

import { useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics, RigidBody } from "@react-three/rapier";
import { Sky, Cloud } from "@react-three/drei";
import * as THREE from "three";
import Target from "./target";
import Bow from "./bow";
import Arrow, { type ArrowLaunch } from "./arrow";
import { useAimControls } from "@/hooks/use-archery-3d-aim";
import { useArcheryStore } from "@/store/archery-3d-store";

// Base forward speed at full draw power, before wind/gravity act on
// it - tuned against the target sitting ~22 units downrange so a
// full-power, dead-center shot lands roughly on target at 0 wind.
const BASE_LAUNCH_SPEED = 32;
const NOCK_POSITION: [number, number, number] = [0.55, 1.42, 4.15];

let nextArrowId = 1;

export default function ArcheryExperience() {
  const [activeArrows, setActiveArrows] = useState<ArrowLaunch[]>([]);
  const isFlyingRef = useRef(false);

  const startFlight = useArcheryStore((s) => s.startFlight);
  const endFlight = useArcheryStore((s) => s.endFlight);
  const rollWind = useArcheryStore((s) => s.rollWind);

  const handleFire = useCallback(
    (drag: { dx: number; dy: number; power: number }) => {
      if (isFlyingRef.current) return;
      if (useArcheryStore.getState().arrowsLeft <= 0) return;

      // Aim: this is a slingshot/inverse-drag mechanic (drag down-and-
      // left, the arrow launches up-and-right) - the same gesture
      // every mobile archery/Angry-Birds-style game uses, and why
      // yaw gets negated below rather than applied directly. Vertical
      // drag adds a touch of extra arc on top of the natural gravity
      // drop. Both axes are clamped so a wild drag can't send the
      // arrow somewhere absurd.
      const yaw = THREE.MathUtils.clamp(drag.dx, -0.6, 0.6);
      const pitch = 0.12 + THREE.MathUtils.clamp(drag.dy * 0.18, -0.05, 0.25);
      const speed = BASE_LAUNCH_SPEED * (0.55 + drag.power * 0.45);

      // Build a single unit "downrange" direction from yaw/pitch and
      // *then* scale by speed - grafting `pitch * speed` and
      // `-yaw * speed` onto separate axes of an already -Z-length-`speed`
      // vector (the old approach) silently inflates the vector's real
      // magnitude past `speed` as soon as either angle is nonzero, so
      // a lofted or angled shot was actually launching faster than a
      // flat center shot at the same draw power. Composing yaw/pitch
      // into a unit vector first keeps `speed` meaning exactly what it
      // says regardless of aim angle.
      const direction = new THREE.Vector3(-yaw, pitch, -1).normalize();

      // Combine aim with the current wind for the shot's initial
      // heading - the launch impulse itself only needs a *fraction*
      // of the wind folded in (a rough "you compensated your aim"
      // nudge); the dominant, ongoing wind effect is the continuous
      // per-frame force applied inside Arrow.tsx's useFrame, which is
      // what actually curves the arrow's path over its flight rather
      // than just its initial direction.
      const wind = useArcheryStore.getState().currentWind;
      const velocity: [number, number, number] = [
        direction.x * speed + wind.x * 0.5,
        direction.y * speed,
        direction.z * speed + wind.z * 0.5,
      ];

      isFlyingRef.current = true;
      startFlight();
      setActiveArrows((prev) => [
        ...prev,
        { id: nextArrowId++, position: NOCK_POSITION, velocity },
      ]);
    },
    [startFlight],
  );

  const handleSettled = useCallback(
    (id: number) => {
      setActiveArrows((prev) => prev.filter((a) => a.id !== id));
      isFlyingRef.current = false;
      endFlight();
      rollWind();
    },
    [endFlight, rollWind],
  );

  const { aimRef, onPointerDown, onPointerMove, onPointerUp } = useAimControls({
    onFire: handleFire,
    canAim: () =>
      !isFlyingRef.current && useArcheryStore.getState().arrowsLeft > 0,
  });

  return (
    <div
      className="h-full w-full touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Canvas
        shadows
        camera={{ position: [0, 1.7, 6], fov: 50, near: 0.1, far: 200 }}
        dpr={[1, 1.75]}
      >
        <color attach="background" args={["#bcdcf0"]} />
        <fog attach="fog" args={["#cfe6f2", 30, 95]} />
        <Sky sunPosition={[80, 40, -60]} turbidity={4} rayleigh={1.2} />
        <Cloud position={[-18, 16, -50]} opacity={0.45} speed={0.08} />
        <Cloud position={[16, 20, -65]} opacity={0.35} speed={0.06} />

        <hemisphereLight args={["#dff0ff", "#4c7a3d", 0.6]} />
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[12, 20, 8]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />

        <Physics gravity={[0, -9.81, 0]}>
          <Ground />
          <Target />
          {activeArrows.map((launch) => (
            <Arrow key={launch.id} launch={launch} onSettled={handleSettled} />
          ))}
        </Physics>

        <Bow aimRef={aimRef} hasArrowNocked={!isFlyingRef.current} />
        <TreeLine />
        <LaneFence />
        <DistanceMarkers />
      </Canvas>
    </div>
  );
}

function Ground() {
  return (
    <RigidBody type="fixed" colliders="cuboid" friction={0.9}>
      {/* Wider fairway strip, slightly brighter, reads as the shooting lane */}
      <mesh position={[0, -0.1, -10]} receiveShadow>
        <boxGeometry args={[10, 0.2, 80]} />
        <meshStandardMaterial color="#5a9146" roughness={1} />
      </mesh>
      {/* Surrounding rough grass, darker so the lane pops */}
      <mesh position={[-25, -0.12, -10]} receiveShadow>
        <boxGeometry args={[40, 0.16, 80]} />
        <meshStandardMaterial color="#3f6633" roughness={1} />
      </mesh>
      <mesh position={[25, -0.12, -10]} receiveShadow>
        <boxGeometry args={[40, 0.16, 80]} />
        <meshStandardMaterial color="#3f6633" roughness={1} />
      </mesh>
    </RigidBody>
  );
}

// Backdrop tree wall - cheap cone+cylinder trees, instanced by hand
// along both sides of the lane and across the far end, so the target
// reads as sitting in a clearing rather than floating in empty fog.
const TREE_OFFSETS: [number, number][] = [
  [-6.5, -6],
  [-8, -14],
  [-6, -22],
  [-9, -30],
  [-6.5, -38],
  [6.5, -6],
  [8, -14],
  [6, -22],
  [9, -30],
  [6.5, -38],
  [-4, -46],
  [-1.5, -47],
  [1.5, -47],
  [4, -46],
  [7, -45],
  [-7, -45],
];

function Tree({ x, z }: { x: number; z: number }) {
  const scale = 0.85 + ((Math.abs(x * 13 + z * 7) % 10) / 10) * 0.5;
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 2, 6]} />
        <meshStandardMaterial color="#4a3320" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <coneGeometry args={[1.1, 2.2, 8]} />
        <meshStandardMaterial color="#2f6b34" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.7, 0]} castShadow>
        <coneGeometry args={[0.8, 1.7, 8]} />
        <meshStandardMaterial color="#3a7d3f" roughness={0.9} />
      </mesh>
    </group>
  );
}

function TreeLine() {
  return (
    <>
      {TREE_OFFSETS.map(([x, z], i) => (
        <Tree key={i} x={x} z={z} />
      ))}
    </>
  );
}

// Low wooden fence rails marking the edges of the shooting lane -
// purely decorative, no collider, just visual framing.
function LaneFence() {
  const posts: [number, number][] = [];
  for (let z = 0; z >= -34; z -= 4) {
    posts.push([-5.2, z]);
    posts.push([5.2, z]);
  }
  return (
    <>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.35, z]} castShadow>
          <boxGeometry args={[0.08, 0.7, 0.08]} />
          <meshStandardMaterial color="#5c3b22" roughness={0.85} />
        </mesh>
      ))}
      {[-5.2, 5.2].map((x) => (
        <mesh key={x} position={[x, 0.55, -17]} castShadow>
          <boxGeometry args={[0.06, 0.06, 34]} />
          <meshStandardMaterial color="#6b4a2c" roughness={0.85} />
        </mesh>
      ))}
    </>
  );
}

// Small ground flags at 10/20/30 units downrange so distance actually
// reads visually instead of only appearing as text in the HUD.
function DistanceMarkers() {
  const marks = [10, 20, 30];
  return (
    <>
      {marks.map((d) => (
        <group key={d} position={[-4.6, 0, 4 - d]}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
            <meshStandardMaterial color="#d8d0bf" />
          </mesh>
          <mesh position={[0.12, 0.45, 0]} castShadow>
            <boxGeometry args={[0.22, 0.14, 0.01]} />
            <meshStandardMaterial color={d === 20 ? "#d6362e" : "#e8e0d0"} />
          </mesh>
        </group>
      ))}
    </>
  );
}
