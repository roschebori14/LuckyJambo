"use client";

import { useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics, RigidBody } from "@react-three/rapier";
import { Sky } from "@react-three/drei";
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

      // Combine aim with the current wind for the shot's initial
      // heading - the launch impulse itself only needs a *fraction*
      // of the wind folded in (a rough "you compensated your aim"
      // nudge); the dominant, ongoing wind effect is the continuous
      // per-frame force applied inside Arrow.tsx's useFrame, which is
      // what actually curves the arrow's path over its flight rather
      // than just its initial direction.
      const wind = useArcheryStore.getState().currentWind;
      const velocity: [number, number, number] = [
        -yaw * speed + wind.x * 0.5,
        pitch * speed,
        -speed + wind.z * 0.5,
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
    canAim: () => !isFlyingRef.current && useArcheryStore.getState().arrowsLeft > 0,
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
        <Sky sunPosition={[80, 40, -60]} turbidity={4} rayleigh={1.2} />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[12, 20, 8]}
          intensity={1.4}
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

        <Bow aimRef={aimRef} />
      </Canvas>
    </div>
  );
}

function Ground() {
  return (
    <RigidBody type="fixed" colliders="cuboid" friction={0.9}>
      <mesh position={[0, -0.1, -10]} receiveShadow>
        <boxGeometry args={[60, 0.2, 80]} />
        <meshStandardMaterial color="#4c7a3d" roughness={1} />
      </mesh>
    </RigidBody>
  );
}
