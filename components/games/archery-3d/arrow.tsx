"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  CylinderCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import { useArcheryStore } from "@/store/archery-3d-store";

export interface ArrowLaunch {
  id: number;
  position: [number, number, number];
  velocity: [number, number, number];
}

interface ArrowProps {
  launch: ArrowLaunch;
  /** Called once the arrow has clearly finished its flight (fallen
   * below the ground plane, or simply been alive too long) so the
   * parent can drop it from the active-arrows list and free its
   * RigidBody. Target.tsx's collision handler is what actually
   * *scores* a hit; this callback only handles cleanup/timeout, so it
   * still fires for a clean miss that sails past everything. */
  onSettled: (id: number) => void;
}

// The mesh is authored with its tip along local +Y (a cylinder's
// default axis), so that's the "forward" vector the velocity-lookAt
// math below rotates *from*, not the more common -Z convention you'd
// use for a camera-like object.
//
// Note on implementation choice: a literal `object3D.lookAt(target)`
// call assumes the object's local -Z axis is "forward" - calling it
// directly on this mesh would orient the wrong local axis toward the
// velocity direction (its actual tip, +Y, would end up pointing
// sideways). `Quaternion.setFromUnitVectors(from, to)` is the direct
// generalization of the same idea for an arbitrary forward axis, and
// is what's used below; it produces the same "point toward this
// direction" result `lookAt` gives you, just correctly for a +Y
// -authored mesh instead of forcing an extra corrective rotation on
// top of a real `lookAt()` call.
const LOCAL_FORWARD = new THREE.Vector3(0, 1, 0);
const MAX_LIFETIME_MS = 6000;
const REST_Y = -5; // world Y below which the arrow is considered gone

// How quickly the arrow's lateral velocity eases toward the wind's
// velocity, in 1/s (bigger = snappier response to wind, reaches near-
// full drift sooner). ~3.5 gives a noticeable curve within the first
// third of a full-power shot's flight while staying bounded - see the
// comment above the wind block in useFrame for why this replaced a
// constant-force model.
const WIND_LATERAL_RELAX_RATE = 3.5;

export default function Arrow({ launch, onSettled }: ArrowProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);
  const spawnedAt = useRef(performance.now());
  const settledRef = useRef(false);

  // Fresh temporaries reused every frame instead of allocated every
  // frame - avoids garbage-collector pressure in the hot path.
  const velocityVec = useRef(new THREE.Vector3());
  const targetQuat = useRef(new THREE.Quaternion());

  useEffect(() => {
    // Give the arrow its initial launch velocity exactly once, right
    // after the physics body exists. Rotation is driven explicitly
    // every frame from the current velocity (see useFrame below)
    // rather than left to physics torque, so gravity/impact never
    // makes the body tumble on its own - all visible rotation comes
    // from that per-frame velocity-alignment, which is the effect the
    // brief is actually asking for ("tip always points where it's
    // traveling", not "physically accurate tumbling"). Critically,
    // this also keeps the real collider's orientation in sync with
    // the flight path (see the note in useFrame) - `lockRotations`
    // would prevent that sync entirely.
    rigidBodyRef.current?.setLinvel(
      { x: launch.velocity[0], y: launch.velocity[1], z: launch.velocity[2] },
      true,
    );

    // Face the launch direction immediately, rather than waiting for
    // the first useFrame tick to notice a nonzero speed - without
    // this the arrow renders one frame (sometimes more, if the very
    // first tick's speed reads under the 0.05 threshold) in its
    // default +Y rest pose before snapping to face where it's
    // actually headed, which reads as a visible pop on release. This
    // sets the real body rotation (not just the visual mesh) so the
    // collider starts out correctly aligned too.
    const v = launch.velocity;
    const initialSpeed = Math.hypot(v[0], v[1], v[2]);
    if (rigidBodyRef.current && initialSpeed > 1e-4) {
      const dir = new THREE.Vector3(v[0], v[1], v[2]).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(LOCAL_FORWARD, dir);
      rigidBodyRef.current.setRotation(
        { x: q.x, y: q.y, z: q.z, w: q.w },
        true,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_state, delta) => {
    const rb = rigidBodyRef.current;
    const visual = visualRef.current;
    if (!rb || !visual || settledRef.current) return;

    // --- CRITICAL PERF PATH ---
    // Everything below runs every frame for every live arrow and
    // must never call setState/a Zustand setter or allocate objects -
    // both would either re-render React or thrash the GC at 60fps.
    const v = rb.linvel();
    velocityVec.current.set(v.x, v.y, v.z);
    const speed = velocityVec.current.length();

    if (speed > 0.05) {
      velocityVec.current.normalize();
      targetQuat.current.setFromUnitVectors(LOCAL_FORWARD, velocityVec.current);

      // Rotate the REAL physics body to face velocity, not just the
      // visual mesh. Previously only `visual.quaternion` was updated
      // here while the RigidBody had `lockRotations` set, meaning the
      // actual CylinderCollider never turned to follow the flight
      // path - it stayed pointed straight up (its spawn orientation)
      // for the whole flight while only its on-screen mesh looked
      // correctly angled. That mismatched collider would then catch
      // the Ground/Target/fence colliders at odd angles the visual
      // mesh looked clear of, producing exactly the sideways
      // "deflection" bend during flight. Setting the body's rotation
      // directly (instead of relying on lockRotations + physics
      // torque) keeps the same "always face velocity, no physical
      // tumbling" intent, just applied to the shape that's actually
      // colliding.
      rb.setRotation(
        {
          x: targetQuat.current.x,
          y: targetQuat.current.y,
          z: targetQuat.current.z,
          w: targetQuat.current.w,
        },
        true,
      );
      // The visual mesh is a child of the RigidBody's own group, so
      // it inherits that real rotation automatically - no separate
      // slerp needed, and no risk of the two ever disagreeing again.
      visual.quaternion.identity();
    }

    // Continuous wind - reading directly from the store here (not a
    // subscribed selector) is deliberate, since useFrame already runs
    // outside React's render cycle and a subscription would only add
    // overhead without adding correctness.
    //
    // Deliberately NOT a constant addForce (an earlier version of
    // this used one): under a constant force, lateral displacement
    // grows with t^2, since velocity itself keeps climbing for the
    // whole flight with nothing to cap it - that reads as "barely
    // curves, then bends hard right at the end," and gets *worse*,
    // not better, for slower/higher-arcing shots that spend longer in
    // the air. Bumping the RigidBody's overall linearDamping doesn't
    // fix that either - it damps the *whole* velocity vector, so it
    // bleeds off forward speed too, which means more airtime for the
    // same wind force to keep compounding, netting even more drift.
    //
    // Instead, this eases the arrow's lateral speed toward the wind's
    // speed - like real aerodynamic drag depends on the *relative*
    // velocity between the arrow and the moving air, not a flat push.
    // That's self-limiting (it stops accelerating once it's drifting
    // with the wind) and front-loads the curve instead of back-
    // loading it. It's applied straight to velocity via setLinvel,
    // not through addForce, so it's independent of the collider's
    // mass/density and the RigidBody's linearDamping entirely - wind
    // feel is tuned only by WIND_LATERAL_RELAX_RATE below, not by
    // physics params that also affect flight arc/reach.
    const wind = useArcheryStore.getState().currentWind;
    const newVx = v.x + WIND_LATERAL_RELAX_RATE * (wind.x - v.x) * delta;
    const newVz = v.z + WIND_LATERAL_RELAX_RATE * (wind.z - v.z) * delta;
    rb.setLinvel({ x: newVx, y: v.y, z: newVz }, true);

    // Cleanup: an arrow that's fallen well below the ground, or has
    // simply been alive too long (grazed something and got stuck),
    // gets retired so the physics world doesn't accumulate bodies
    // forever across a long session.
    const translation = rb.translation();
    const alive = performance.now() - spawnedAt.current;
    if (translation.y < REST_Y || alive > MAX_LIFETIME_MS) {
      settledRef.current = true;
      onSettled(launch.id);
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={launch.position}
      colliders={false}
      linearDamping={0.02}
      angularDamping={2}
      userData={{ type: "arrow", id: launch.id }}
    >
      {/* Thin capsule-ish collider approximating the shaft - cheaper
          and more stable at high speed than an auto-generated hull
          around the visual mesh (thin fast-moving hulls are exactly
          the shape that tunnels through thin colliders most easily).
          `density` is explicit and deliberate: this collider's volume
          is tiny (halfHeight 0.4, radius 0.02 -> ~0.001 m^3), so
          Rapier's default density of 1 would auto-compute a mass of
          about 1 gram. A real arrow is roughly 20-30g; at 1g, any
          per-frame force (wind, in particular - see Arrow's useFrame)
          produces wildly exaggerated acceleration because F = m*a
          divides by that tiny mass. Setting density so the resolved
          mass lands around 25g (density = mass / volume ≈ 25 for
          this collider's volume) is what keeps gravity and wind in
          realistic proportion instead of wind dominating every shot. */}
      <CylinderCollider args={[0.4, 0.02]} density={25} />
      <group ref={visualRef}>
        {/* Shaft */}
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.8, 8]} />
          <meshStandardMaterial color="#caa472" roughness={0.6} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.42, 0]} castShadow>
          <coneGeometry args={[0.025, 0.12, 8]} />
          <meshStandardMaterial
            color="#8a8a8a"
            metalness={0.6}
            roughness={0.35}
          />
        </mesh>
        {/* Fletching */}
        <mesh position={[0, -0.36, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.05, 0.14, 4]} />
          <meshStandardMaterial color="#d1483a" roughness={0.8} />
        </mesh>
      </group>
    </RigidBody>
  );
}
