"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { MAX_DRAG_PX, type AimState } from "@/hooks/use-archery-3d-aim";
import { computeAimDirection } from "@/lib/archery-aim";

interface AimCameraProps {
  aimRef: RefObject<AimState>;
}

// Matches the resting position/fov the old static Canvas `camera`
// prop used - swapping in a driven <PerspectiveCamera> here should
// change nothing about the rest pose, only add the ability to
// animate away from it while drawing.
const REST_POSITION = new THREE.Vector3(0, 1.7, 6);
const REST_FOV = 50;
const AIM_FOV = 32;
// Pulled in toward the bow and nudged right/down slightly, as if
// leaning in to sight down the arrow shaft - kept modest so the
// camera doesn't clip through the bow model at full draw.
const AIM_OFFSET = new THREE.Vector3(0.25, -0.12, -1.4);

export default function AimCamera({ aimRef }: AimCameraProps) {
  const camRef = useRef<THREE.PerspectiveCamera>(null);

  // Reused per-frame temporaries - same "no allocation in the hot
  // path" rule the rest of this codebase follows in arrow.tsx/bow.tsx.
  const targetPos = useRef(new THREE.Vector3());
  const restQuat = useRef(new THREE.Quaternion()); // identity: looking down -Z, matches the old static camera's implicit rotation
  const aimQuat = useRef(new THREE.Quaternion());
  const blendedQuat = useRef(new THREE.Quaternion());
  const worldForward = useRef(new THREE.Vector3(0, 0, -1));
  const dir = useRef(new THREE.Vector3());

  useFrame(() => {
    const cam = camRef.current;
    if (!cam) return;
    const aim = aimRef.current;

    // Blend on power, not just isDragging - blending only on the
    // boolean would snap the camera the instant a drag starts at
    // zero power, before the shot reads as "in progress" at all.
    // Tying it to power instead means the zoom/lean motion visibly
    // tracks the draw itself, same rationale as the sway lerp in
    // bow.tsx.
    const t = aim.isDragging ? THREE.MathUtils.clamp(aim.power, 0, 1) : 0;

    targetPos.current.copy(REST_POSITION);
    if (t > 0) {
      targetPos.current.addScaledVector(AIM_OFFSET, t);
    }
    cam.position.lerp(targetPos.current, 0.15);

    cam.fov = THREE.MathUtils.lerp(
      cam.fov,
      THREE.MathUtils.lerp(REST_FOV, AIM_FOV, t),
      0.12,
    );
    cam.updateProjectionMatrix();

    // computeAimDirection returns the exact world-space heading a
    // release right now would launch along (same function
    // handleFire uses) - orienting the camera toward that, blended
    // against the rest pose's forward (-Z), is what makes "look
    // through the sight" and "where the arrow goes" the same thing
    // instead of two approximations of each other.
    const dx = aim.dragX / MAX_DRAG_PX;
    const dy = aim.dragY / MAX_DRAG_PX;
    dir.current.copy(computeAimDirection(dx, dy));
    aimQuat.current.setFromUnitVectors(worldForward.current, dir.current);
    blendedQuat.current.copy(restQuat.current).slerp(aimQuat.current, t);
    cam.quaternion.slerp(blendedQuat.current, 0.18);
  });

  return (
    <PerspectiveCamera
      ref={camRef}
      makeDefault
      position={REST_POSITION.toArray()}
      fov={REST_FOV}
      near={0.1}
      far={200}
    />
  );
}
