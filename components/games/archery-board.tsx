"use client";

import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import type { ArcheryState, ArcheryShot, ArcheryShotInput } from "@/types/archery";
import { TARGET_RADIUS, RING_WIDTH, calculateScore } from "@/lib/games/archery/engine";
import { simulateTrajectory, targetZFor, MAX_POWER, MIN_RELEASE_POWER } from "@/lib/games/archery/physics";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";

const FOCAL_LENGTH = 1000;

export default function ArcheryBoard({ matchId, userId }: { matchId: string; userId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<Phaser.Scene | null>(null);
  const shootingRef = useRef(false);
  const stateRef = useRef<ArcheryState | null>(null);

  const [state, setState] = useState<ArcheryState | null>(null);
  const [error, setError] = useState("");
  const [shooting, setShooting] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const { play } = useSound();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const isMyTurn =
    !!state &&
    state.current_turn === (state.a_player_id === userId ? "A" : "B") &&
    !state.game_over;
  const playerA = state?.a_player_id === userId ? "You" : "Player A";
  const playerB = state?.b_player_id === userId ? "You" : "Player B";

  // Fetch + realtime
  useEffect(() => {
    async function fetchState() {
      try {
        const res = await fetch(`/api/matches/status?id=${matchId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch state");
        if (data.match?.game_state) setState(data.match.game_state as ArcheryState);
      } catch (err: any) {
        setError(err.message);
      }
    }
    fetchState();
  }, [matchId]);

  useMatchRealtime(matchId, (row) => {
    if (shootingRef.current) return;
    if (row.game_state) setState(row.game_state as ArcheryState);
  });

  useEffect(() => {
    shootingRef.current = shooting;
  }, [shooting]);

  // Phaser mount - runs exactly once. Deliberately depends only on a
  // boolean ("do we have an initial state yet"), never on `state`
  // itself. `state` gets a new object identity on every shot/realtime
  // update, and this used to be in the effect's dependency array -
  // which meant the entire Phaser game (canvas, textures, camera, the
  // arrow, everything) was destroyed and rebuilt from scratch after
  // every single shot, including the player's own. That's the
  // "especially the arrow" bug: it wasn't that the arrow rendered
  // wrong, it was that it (and the whole scene) got torn down and
  // reloaded from the network every time state changed. Game state is
  // synced into already-live Phaser objects by the separate effects
  // below instead.
  const hasInitialState = state !== null;
  useEffect(() => {
    if (!hasInitialState || gameRef.current || !containerRef.current) return;
    const initialState = stateRef.current!;
    const initialMyColor = initialState.a_player_id === userId ? 0xef4444 : 0x22d3ee;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.CANVAS,
      parent: containerRef.current,
      width,
      height,
      backgroundColor: "#0a0e17",
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: {
        preload: function (this: Phaser.Scene) {
          this.load.image("bg", "/assets/archery/bg.jpg");
        },
        create: function (this: Phaser.Scene) {
          sceneRef.current = this;

          const w = this.scale.width;
          const h = this.scale.height;
          const cx = w / 2;
          const cy = h / 2;

          this.registry.set("cameraZ", 0);
          this.registry.set("cameraX", 0);
          this.registry.set("cameraY", -20);

          // bg.jpg's ground path converges to a vanishing point at
          // roughly (65%, 50%) of the image, not image-center - the
          // horizon this photo actually has. The projection's screen
          // origin (where world (0,0,z) lands) needs to sit there
          // too, or the target/arrow float in a different "world"
          // than the ground lines painted in the photo, which was the
          // original bug (target rendered high and off-center from
          // the path).
          const HORIZON_FRAC_X = 0.5;
          const HORIZON_FRAC_Y = 0.5;

          const project = (x: number, y: number, z: number) => {
            const camX = this.registry.get("cameraX");
            const camY = this.registry.get("cameraY");
            const camZ = this.registry.get("cameraZ");
            const originX = this.registry.get("originX") ?? cx;
            const originY = this.registry.get("originY") ?? cy;
            const relativeZ = z - camZ;
            if (relativeZ <= 0) return { x: 0, y: 0, scale: 0, visible: false };
            const scale = FOCAL_LENGTH / (FOCAL_LENGTH + relativeZ);
            return {
              x: originX + (x - camX) * scale,
              y: originY - (y - camY) * scale,
              scale,
              visible: true,
            };
          };
          this.registry.set("project", project);

          // Background - bg.jpg is a tall/narrow photo (roughly 0.56
          // width:height) while the play area is 3:4 (0.75). "Contain"
          // avoided cropping but left black bars on the sides, which
          // doesn't match the reference (full-bleed background, no
          // bars). Go back to "cover" (fills the frame, some crop),
          // but - unlike the original bug - recompute the horizon
          // origin against THIS actual crop, so the drawn target
          // still lands on the photo's real vanishing point instead
          // of floating.
          const bgImg = this.add.image(cx, cy, "bg");
          const baseScale = Math.max(w / bgImg.width, h / bgImg.height);
          bgImg.setScale(baseScale);
          this.registry.set("bgImg", bgImg);
          this.registry.set("bgBaseScale", baseScale);

          const bgLeft = cx - (bgImg.width * baseScale) / 2;
          const bgTop = cy - (bgImg.height * baseScale) / 2;
          this.registry.set("originX", bgLeft + bgImg.width * baseScale * HORIZON_FRAC_X);
          this.registry.set("originY", bgTop + bgImg.height * baseScale * HORIZON_FRAC_Y);

          // Target
          const targetGroup = this.add.container(0, 0);
          this.registry.set("targetGroup", targetGroup);

          const legLeft = this.add.rectangle(-45, -60, 10, 220, 0x3d2b1f);
          legLeft.setAngle(-8);
          const legRight = this.add.rectangle(45, -60, 10, 220, 0x3d2b1f);
          legRight.setAngle(8);
          targetGroup.add([legLeft, legRight]);

          const boardSize = TARGET_RADIUS * 2 + 60;
          const backboard = this.add.rectangle(0, 0, boardSize, boardSize, 0xf7f5f0);
          backboard.setStrokeStyle(3, 0xcfcac0);
          targetGroup.add(backboard);

          // Classic 5-color, 10-ring target face: white, black, blue,
          // red, gold - outermost to center, two rings per color.
          const colors = [
            0xffffff, 0xffffff, 0x2d3436, 0x2d3436, 0x0984e3, 0x0984e3, 0xd63031, 0xd63031,
            0xf9ca24, 0xf9ca24,
          ];
          for (let i = 0; i < 10; i++) {
            const radius = TARGET_RADIUS - i * RING_WIDTH;
            const ring = this.add.circle(0, 0, radius, colors[i]);
            if (i % 2 === 0) ring.setStrokeStyle(2, 0x000000, 0.2);
            else if (i === 1 || i === 3) ring.setStrokeStyle(1, 0xffffff, 0.5);
            targetGroup.add(ring);
          }

          const targetShadow = this.add.ellipse(0, 200, 150, 30, 0x000000, 0.3);
          targetGroup.add(targetShadow);

          // Arrow (in flight) - only ever shown while a shot is
          // actually airborne. Projected through the same 3D camera
          // as the target, so its flight path visually agrees with
          // where the target sits.
          const arrowGroup = this.add.container(0, 0);
          this.registry.set("arrowGroup", arrowGroup);
          const shaft = this.add.rectangle(0, -30, 6, 80, 0x3d3d3d);
          const fletching = this.add.triangle(0, -60, 0, -20, 14, 10, -14, 10, initialMyColor);
          const tip = this.add.triangle(0, 15, 0, 15, 8, -12, -8, -12, 0xc0c0c0);
          arrowGroup.add([shaft, fletching, tip]);
          arrowGroup.visible = false;
          this.registry.set("arrowColor", initialMyColor);

          // Foreground bow+arrow - a fixed, screen-space "you are
          // holding this bow" overlay pinned to the bottom-right
          // corner, matching the reference framing (a large riser
          // edge-of-frame with a nocked arrow pointing up-left at the
          // target). This is deliberately NOT run through the 3D
          // project() - it's a HUD element, not a world object, so it
          // can never end up drifting toward the target the way the
          // old single shared arrow did. It's swapped out for the
          // real 3D arrowGroup only for the brief in-flight animation.
          const bowGroup = this.add.container(w, h);
          bowGroup.setScrollFactor(0);
          bowGroup.setDepth(900);
          const riserH = h * 2.2;
          const riserW = w * 0.5;
          const RISER_ANGLE = -8;
          const riser = this.add.rectangle(0, 0, riserW, riserH, 0x6b4226);
          riser.setStrokeStyle(2, 0x4a2c17, 0.8);
          riser.setAngle(RISER_ANGLE);
          const riserHighlight = this.add.rectangle(-riserW * 0.22, 0, riserW * 0.22, riserH * 0.96, 0x8a5a34);
          riserHighlight.setAngle(RISER_ANGLE);
          // Nock (fletching) position measured from the reference
          // photo at ~70% width / ~62% height, tip at ~64% width /
          // ~54% height - both expressed relative to the bottom-right
          // anchor so they scale with any canvas size.
          const nockX = -w * 0.3;
          const nockY = -h * 0.38;
          const bowShaft = this.add.rectangle(nockX * 0.5, nockY * 0.5, 10, Math.abs(nockY) * 1.1, 0x4a4a4a);
          bowShaft.setAngle(RISER_ANGLE);
          const bowFletch = this.add.triangle(
            nockX,
            nockY,
            0,
            -18,
            18,
            14,
            -18,
            14,
            0xf2f2f2
          );
          bowFletch.setStrokeStyle(1, 0xcccccc, 0.8);
          bowFletch.setAngle(RISER_ANGLE);
          const bowTip = this.add.triangle(
            nockX * 1.2,
            nockY * 1.2,
            0,
            18,
            9,
            -14,
            -9,
            -14,
            0xd9d9d9
          );
          bowTip.setStrokeStyle(1, 0x9a9a9a, 0.9);
          bowTip.setAngle(RISER_ANGLE);
          bowGroup.add([riser, riserHighlight, bowShaft, bowFletch, bowTip]);
          this.registry.set("bowGroup", bowGroup);

          // Aim reticle - a persistent marker at the predicted impact
          // point, distinct from the trajectory dots. Every reference
          // archery game (Archery King, ArcheryWorldCup) gives you a
          // clear "this is where it's going to land" indicator, not
          // just a dotted arc - the arc shows the path, the reticle
          // answers the actual question you're aiming to answer.
          const reticle = this.add.container(0, 0);
          const reticleRing = this.add.circle(0, 0, 10, 0x000000, 0);
          reticleRing.setStrokeStyle(2, 0xffd166, 0.9);
          const reticleDot = this.add.circle(0, 0, 2, 0xffd166, 1);
          reticle.add([reticleRing, reticleDot]);
          reticle.visible = false;
          this.registry.set("reticle", reticle);

          // Trajectory arc
          const trajectoryDots = Array.from({ length: 18 }).map(() => {
            const dot = this.add.circle(0, 0, 4, 0xffffff, 0.7);
            dot.visible = false;
            return dot;
          });
          this.registry.set("trajectoryDots", trajectoryDots);

          // Floating score/impact text
          const scoreText = this.add.text(0, 0, "", {
            fontSize: "64px",
            fontFamily: "Inter, sans-serif",
            fontStyle: "900",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 8,
            align: "center",
          });
          scoreText.setOrigin(0.5);
          scoreText.visible = false;
          this.registry.set("scoreText", scoreText);

          // Power meter (screen-space) - every reference game leads
          // with this so you know how hard you're about to shoot
          // before you commit to releasing.
          const meterX = w - 34;
          const meterTop = h * 0.3;
          const meterHeight = h * 0.4;
          const meterTrack = this.add.rectangle(meterX, meterTop + meterHeight / 2, 14, meterHeight, 0x000000, 0.35);
          meterTrack.setStrokeStyle(2, 0xffffff, 0.5);
          const meterFill = this.add.rectangle(meterX, meterTop + meterHeight, 10, 0, 0x22c55e, 0.95);
          meterFill.setOrigin(0.5, 1);
          const meterLabel = this.add
            .text(meterX, meterTop - 22, "PWR", {
              fontSize: "12px",
              fontFamily: "Inter, sans-serif",
              fontStyle: "800",
              color: "#ffffff",
              stroke: "#000000",
              strokeThickness: 3,
            })
            .setOrigin(0.5);
          const meterPct = this.add
            .text(meterX, meterTop + meterHeight + 16, "", {
              fontSize: "13px",
              fontFamily: "Inter, sans-serif",
              fontStyle: "900",
              color: "#ffffff",
              stroke: "#000000",
              strokeThickness: 3,
            })
            .setOrigin(0.5, 0);
          [meterTrack, meterFill, meterLabel, meterPct].forEach((o) => {
            o.visible = false;
            o.setScrollFactor(0);
            o.setDepth(1000);
          });
          this.registry.set("powerMeter", {
            track: meterTrack,
            fill: meterFill,
            label: meterLabel,
            pct: meterPct,
            top: meterTop,
            height: meterHeight,
          });

          // Wind indicator - screen-space HUD panel drawn directly on
          // the canvas above the target, matching the reference: a
          // dark semi-transparent box with a red border, "WIND:"
          // label in white, the value in red, and a small compass
          // circle showing which way it's blowing.
          const windBoxW = w * 0.3;
          const windBoxH = h * 0.085;
          const windBoxX = cx;
          const windBoxY = h * 0.34;

          const windBg = this.add.rectangle(windBoxX, windBoxY, windBoxW, windBoxH, 0x000000, 0.45);
          windBg.setStrokeStyle(2, 0xef4444, 0.9);
          windBg.setScrollFactor(0);
          windBg.setDepth(950);

          const windLabel = this.add
            .text(windBoxX - windBoxW * 0.26, windBoxY, "WIND:", {
              fontSize: "16px",
              fontFamily: "Inter, sans-serif",
              fontStyle: "800",
              color: "#ffffff",
            })
            .setOrigin(0.5);
          windLabel.setScrollFactor(0);
          windLabel.setDepth(951);

          const windValue = this.add
            .text(windBoxX - windBoxW * 0.03, windBoxY, "0.0", {
              fontSize: "16px",
              fontFamily: "Inter, sans-serif",
              fontStyle: "900",
              color: "#ef4444",
            })
            .setOrigin(0.5);
          windValue.setScrollFactor(0);
          windValue.setDepth(951);

          const windIcon = this.add.container(windBoxX + windBoxW * 0.33, windBoxY);
          const windIconRing = this.add.circle(0, 0, 10, 0x000000, 0);
          windIconRing.setStrokeStyle(2, 0xef4444, 0.9);
          const windIconArrow = this.add.triangle(0, -6, 0, -4, 3, 4, -3, 4, 0xef4444);
          windIcon.add([windIconRing, windIconArrow]);
          windIcon.setScrollFactor(0);
          windIcon.setDepth(951);

          this.registry.set("windHud", {
            bg: windBg,
            label: windLabel,
            value: windValue,
            icon: windIcon,
            iconArrow: windIconArrow,
          });

          setBoardReady(true);
        },
        update: function (this: Phaser.Scene) {
          if (!this.registry.has("project")) return;

          const w = this.scale.width;
          const h = this.scale.height;
          const cx = w / 2;
          const cy = h / 2;
          const project = this.registry.get("project");
          const targetGroup = this.registry.get("targetGroup");
          const arrowGroup = this.registry.get("arrowGroup");
          const bgImg = this.registry.get("bgImg");
          const targetZ: number = this.registry.get("targetZ") ?? targetZFor(1);

          const camZ = this.registry.get("cameraZ");
          const camX = this.registry.get("cameraX");
          const baseScale = this.registry.get("bgBaseScale") ?? Math.max(w / bgImg.width, h / bgImg.height);
          bgImg.setScale(baseScale * (1 + camZ * 0.0001));
          bgImg.setPosition(cx - camX * 0.05, cy + camZ * 0.02);

          // Target sits at world y=0 (ground level, at the horizon) -
          // not y=50, which was floating it above the vanishing point
          // even after the origin fix above.
          const targetPos = project(0, 0, targetZ);
          if (targetPos.visible) {
            targetGroup.setPosition(targetPos.x, targetPos.y);
            targetGroup.setScale(targetPos.scale);
          }

          const arrowData = this.registry.get("arrowData");
          if (arrowData && arrowData.active) {
            const { x, y, z, yaw } = arrowData;
            const arrPos = project(x, y, z);
            if (arrPos.visible) {
              arrowGroup.visible = true;
              arrowGroup.setPosition(arrPos.x, arrPos.y);
              arrowGroup.setScale(arrPos.scale);
              arrowGroup.rotation = -yaw;
            } else {
              arrowGroup.visible = false;
            }
          }

          const dots = this.registry.get("trajectoryDots");
          const traj = this.registry.get("trajectory");
          if (traj && traj.length > 0) {
            dots.forEach((dot: Phaser.GameObjects.Arc, i: number) => {
              if (i < traj.length) {
                const p = project(traj[i].x, traj[i].y, traj[i].z);
                if (p.visible) {
                  dot.setPosition(p.x, p.y);
                  dot.setScale(p.scale);
                  dot.setAlpha(0.35 + 0.5 * (i / traj.length));
                  dot.visible = true;
                } else dot.visible = false;
              } else {
                dot.visible = false;
              }
            });
          } else {
            dots.forEach((dot: Phaser.GameObjects.Arc) => (dot.visible = false));
          }

          const bowGroup = this.registry.get("bowGroup");
          if (bowGroup) bowGroup.setPosition(w, h);

          const reticle = this.registry.get("reticle") as Phaser.GameObjects.Container;
          const reticleTarget = this.registry.get("reticleTarget");
          if (reticle && reticleTarget) {
            const p = project(reticleTarget.x, reticleTarget.y, targetZ);
            if (p.visible) {
              reticle.setPosition(p.x, p.y);
              reticle.setScale(Math.max(0.3, p.scale));
              reticle.visible = true;
            } else {
              reticle.visible = false;
            }
          }
        },
      },
    };

    gameRef.current = new Phaser.Game(config);

    // Belt-and-braces re-measure in case the container was 0x0 (or
    // simply wrong) at the exact instant Phaser booted.
    const raf1 = requestAnimationFrame(() => {
      gameRef.current?.scale.refresh();
      requestAnimationFrame(() => gameRef.current?.scale.refresh());
    });

    return () => {
      cancelAnimationFrame(raf1);
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
      setBoardReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialState]);

  // Sync target distance into the scene whenever the round changes
  useEffect(() => {
    if (!boardReady || !sceneRef.current || !state) return;
    sceneRef.current.registry.set("targetZ", targetZFor(state.target_dist));
  }, [boardReady, state?.target_dist]);

  // Sync wind into the on-canvas HUD whenever it changes
  useEffect(() => {
    if (!boardReady || !sceneRef.current || !state) return;
    const scene = sceneRef.current;
    const windHud = scene.registry.get("windHud");
    if (!windHud) return;
    const speed = Math.abs(state.wind_x);
    windHud.value.setText(speed.toFixed(1));
    const angle = state.wind_x > 0 ? 90 : state.wind_x < 0 ? -90 : 0;
    windHud.iconArrow.setRotation(Phaser.Math.DegToRad(angle));
  }, [boardReady, state?.wind_x]);

  // Render past shots
  useEffect(() => {
    if (!boardReady || !sceneRef.current || !state) return;
    const scene = sceneRef.current;
    const targetGroup = scene.registry.get("targetGroup") as Phaser.GameObjects.Container;
    if (!targetGroup) return;

    targetGroup.list.filter((c) => c.name === "past-arrow").forEach((c) => c.destroy());

    const drawShot = (shot: ArcheryShot, isA: boolean) => {
      const color = isA ? 0xef4444 : 0x22d3ee;
      const group = scene.add.container(shot.finalX, -shot.finalY);
      group.name = "past-arrow";
      const shadow = scene.add.circle(0, 0, 15, 0x000000, 0.4);
      const shaft = scene.add.rectangle(0, 20, 6, 40, 0x3d3d3d);
      const fletching = scene.add.triangle(0, 40, 0, -10, 15, 10, -15, 10, color);
      group.add([shadow, shaft, fletching]);
      targetGroup.add(group);
    };

    state.a_shots.forEach((s) => drawShot(s, true));
    state.b_shots.forEach((s) => drawShot(s, false));
  }, [state?.a_shots.length, state?.b_shots.length, boardReady]);

  // Aim / shoot interaction
  useEffect(() => {
    if (!boardReady || !sceneRef.current || !state || !isMyTurn) return;

    const scene = sceneRef.current;
    const currentState = state;

    const resetArrow = () => {
      scene.registry.set("cameraZ", 0);
      scene.registry.set("cameraX", 0);
      scene.registry.set("cameraY", -20);
      scene.registry.set("arrowData", { active: false, x: 0, y: -100, z: 50, yaw: 0, pitch: 0 });
      const arrowGroup = scene.registry.get("arrowGroup") as Phaser.GameObjects.Container | undefined;
      if (arrowGroup) arrowGroup.visible = false;
      const bowGroup = scene.registry.get("bowGroup") as Phaser.GameObjects.Container | undefined;
      if (bowGroup) bowGroup.visible = true;
      scene.registry.set("trajectory", []);
      scene.registry.set("reticleTarget", null);
      const reticle = scene.registry.get("reticle") as Phaser.GameObjects.Container | undefined;
      if (reticle) reticle.visible = false;

      const meter = scene.registry.get("powerMeter");
      if (meter) {
        meter.track.visible = false;
        meter.fill.visible = false;
        meter.label.visible = false;
        meter.pct.visible = false;
        meter.fill.height = 0;
      }
    };
    resetArrow();

    let isAiming = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let pullPower = 0;
    let aimAngleX = 0;
    let aimAngleY = 0;

    const updatePreview = () => {
      // The live aim preview and the actual shot both run through
      // simulateTrajectory - the exact same function the server will
      // use to score this shot - so what the player sees while aiming
      // is never a lie about what the server will do with it.
      const result = simulateTrajectory(
        pullPower,
        aimAngleX,
        aimAngleY,
        currentState.wind_x,
        currentState.target_dist
      );
      scene.registry.set("trajectory", result.path);
      scene.registry.set("reticleTarget", result.hit ? { x: result.finalX, y: -result.finalY } : null);
    };

    const onPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (shootingRef.current) return;
      isAiming = true;
      startPointerX = pointer.x;
      startPointerY = pointer.y;

      const meter = scene.registry.get("powerMeter");
      if (meter) {
        meter.track.visible = true;
        meter.fill.visible = true;
        meter.label.visible = true;
        meter.pct.visible = true;
      }
    };

    const onPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (!isAiming) return;

      const dx = pointer.x - startPointerX;
      const dy = pointer.y - startPointerY;

      pullPower = Math.max(0, Math.min(MAX_POWER, dy * 0.45));
      aimAngleX = dx * -0.012;
      aimAngleY = (dy - 120) * 0.012;

      // Cosmetic bow-draw: the arrow mesh visually pulls back as you
      // charge power. Purely visual - the actual physics origin used
      // by updatePreview/the real shot is always the canonical launch
      // point, so this can never drift out of sync with scoring.
      const arrowData = scene.registry.get("arrowData");
      scene.registry.set("arrowData", {
        ...arrowData,
        x: aimAngleX * -60,
        y: -100 - pullPower,
        z: 50 - pullPower * 1.5,
        yaw: aimAngleX,
      });

      updatePreview();

      const meter = scene.registry.get("powerMeter");
      if (meter) {
        const pct = Math.round((pullPower / MAX_POWER) * 100);
        meter.fill.height = (pct / 100) * meter.height;
        meter.fill.fillColor = pct > 85 ? 0xef4444 : pct > 55 ? 0xffd166 : 0x22c55e;
        meter.pct.setText(`${pct}%`);
      }
    };

    const submitShot = (input: ArcheryShotInput) => {
      fetch("/api/archery/shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, input }),
      })
        .catch(console.error)
        .finally(() => {
          setShooting(false);
          resetArrow();
        });
    };

    const onPointerUp = () => {
      if (!isAiming) return;
      isAiming = false;
      scene.registry.set("trajectory", []);
      const reticle = scene.registry.get("reticle") as Phaser.GameObjects.Container | undefined;
      if (reticle) reticle.visible = false;

      if (pullPower < MIN_RELEASE_POWER) {
        resetArrow();
        return;
      }

      setShooting(true);
      play("move");

      const bowGroup = scene.registry.get("bowGroup") as Phaser.GameObjects.Container | undefined;
      if (bowGroup) bowGroup.visible = false;
      const arrowGroup = scene.registry.get("arrowGroup") as Phaser.GameObjects.Container | undefined;
      if (arrowGroup) arrowGroup.visible = true;

      const meter = scene.registry.get("powerMeter");
      if (meter) {
        meter.track.visible = false;
        meter.fill.visible = false;
        meter.label.visible = false;
        meter.pct.visible = false;
      }
      scene.cameras.main.shake(90, 0.0015 + (pullPower / MAX_POWER) * 0.0025);

      // Precompute the whole flight once (identical math the server
      // will use), then play it back over a fixed real-time duration
      // - not one physics step per render tick - so a shot that falls
      // well short doesn't drag the animation out for seconds just
      // because the simulation needed more samples.
      const result = simulateTrajectory(
        pullPower,
        aimAngleX,
        aimAngleY,
        currentState.wind_x,
        currentState.target_dist
      );
      const path = result.path;
      const durationMs = Math.min(1500, 900 + 150 * currentState.target_dist);
      const startedAt = scene.time.now;

      const flightTimer = scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          const elapsed = scene.time.now - startedAt;
          const progress = Math.min(1, elapsed / durationMs);
          const idx = Math.min(path.length - 1, Math.floor(progress * path.length));
          const cur = path[idx];
          const next = path[Math.min(path.length - 1, idx + 1)];
          const yaw = Math.atan2(next.x - cur.x, Math.max(1, next.z - cur.z));

          const camZ = scene.registry.get("cameraZ");
          scene.registry.set("cameraZ", camZ + (cur.z - 250 - camZ) * 0.15);
          const camX = scene.registry.get("cameraX");
          scene.registry.set("cameraX", camX + (cur.x * 0.7 - camX) * 0.15);

          scene.registry.set("arrowData", { active: true, x: cur.x, y: cur.y, z: cur.z, yaw, pitch: 0 });

          if (progress >= 1) {
            flightTimer.remove();
            play("archery-hit");
            scene.cameras.main.shake(60, 0.0018);

            const score = result.hit ? calculateScore(result.finalX, result.finalY) : 0;
            const scoreText = scene.registry.get("scoreText") as Phaser.GameObjects.Text;
            scoreText.setText(score > 0 ? `+${score}` : "MISS");
            scoreText.setColor(score >= 9 ? "#ffd166" : score > 0 ? "#ffffff" : "#ef4444");
            scoreText.setPosition(scene.scale.width / 2, scene.scale.height / 2 - 100);
            scoreText.visible = true;
            scoreText.setAlpha(1);
            scoreText.setScale(0.5);

            scene.tweens.add({
              targets: scoreText,
              y: scoreText.y - 150,
              alpha: 0,
              scale: 1.5,
              duration: 1500,
              ease: "Cubic.easeOut",
            });

            scene.time.delayedCall(1300, () => {
              submitShot({ angleX: aimAngleX, angleY: aimAngleY, power: pullPower });
            });
          }
        },
      });
    };

    scene.input.on("pointerdown", onPointerDown);
    scene.input.on("pointermove", onPointerMove);
    scene.input.on("pointerup", onPointerUp);

    return () => {
      scene.input.off("pointerdown", onPointerDown);
      scene.input.off("pointermove", onPointerMove);
      scene.input.off("pointerup", onPointerUp);
      scene.registry.set("arrowData", { active: false });
    };
  }, [boardReady, isMyTurn, state, userId, play, matchId]);

  if (error) return <div className="p-4 text-red-400">{error}</div>;
  if (!state)
    return <div className="p-4 font-medium text-[var(--lj-muted)]">Loading Archery Range...</div>;

  return (
    <div className="flex min-h-screen w-full flex-col items-center gap-0 bg-[var(--lj-navy)] pt-4">
      {/* HUD - matches the platform's dark navy/gold system used
          everywhere else (ludo, pool, word-rush), not a flat white
          iMessage-style card, so this doesn't feel like a different
          app bolted onto Lucky Jambo. */}
      <div className="lj-card mb-2 flex w-full max-w-[600px] items-center justify-between px-4 py-4">
        <div className="flex flex-1 flex-col items-center">
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-lg font-bold text-white shadow-sm">
            {playerA.charAt(0)}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--lj-muted)]">
            {playerA}
          </span>
          <span className="mt-1 text-3xl font-black leading-none text-white">{state.a_score}</span>
        </div>

        <div className="flex flex-none flex-col items-center justify-center border-x border-[var(--lj-border)] px-4">
          <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--lj-muted)]">
            Arrow {state.round} / 3
          </span>
          <span className="mt-0.5 text-[10px] font-semibold text-[var(--lj-muted)]">
            {Math.round(state.target_dist * 20)}yd
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center">
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500 text-lg font-bold text-white shadow-sm">
            {playerB.charAt(0)}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--lj-muted)]">
            {playerB}
          </span>
          <span className="mt-1 text-3xl font-black leading-none text-white">{state.b_score}</span>
        </div>
      </div>

      {/* Aspect-ratio based, not a fixed pixel height, so it scales to
          fit short mobile viewports instead of pushing the shoot area
          off-screen. */}
      <div
        ref={containerRef}
        className="relative aspect-[3/4] max-h-[68vh] w-full max-w-[600px] bg-black shadow-sm"
      />

      <div className="w-full max-w-[600px] border-t border-[var(--lj-border)] bg-[var(--lj-navy)] py-4">
        <p className="text-center text-[15px] font-semibold text-[var(--lj-muted)]">
          {isMyTurn
            ? shooting
              ? "Arrow is flying..."
              : "Pull back to charge power, drag to aim, release to shoot"
            : state.game_over
              ? "Game Over"
              : "Waiting for opponent..."}
        </p>
      </div>
    </div>
  );
}
