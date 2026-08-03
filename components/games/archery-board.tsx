"use client";

import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import type { ArcheryState, ArcheryShot, ArcheryShotInput } from "@/types/archery";
import { TARGET_RADIUS, RING_WIDTH, calculateScore } from "@/lib/games/archery/engine";
import { simulateTrajectory, targetZFor, MAX_POWER, MIN_RELEASE_POWER } from "@/lib/games/archery/physics";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";

const FOCAL_LENGTH = 1000;

// ---------------------------------------------------------------------
// Pure presentation helpers. Nothing below reads or writes game state,
// scoring, physics, or network calls - they only build/reposition
// Phaser display objects. buildArrowGraphics() is deliberately the
// ONE place an arrow's look is defined, and is used for the in-flight
// arrow, the foreground nocked arrow, and planted past-shot arrows, so
// "the flying arrow looks identical to the aiming arrow" holds by
// construction instead of by keeping three drawings in sync by hand.
//
// Local coordinate convention (unrotated): rear/nock at negative y,
// head/tip at positive y. This matches the original primitive arrow's
// layout exactly, which matters because the in-flight arrow's rotation
// (`arrowGroup.rotation = -yaw` in the update loop) was tuned against
// that layout - changing it would visually mis-point the arrow in
// flight even though the physics/yaw math itself is untouched.
// ---------------------------------------------------------------------

function buildArrowGraphics(
  scene: Phaser.Scene,
  opts: { length?: number; thickness?: number; fletchColor?: number } = {}
): Phaser.GameObjects.Container {
  const length = opts.length ?? 120;
  const thickness = opts.thickness ?? 5;
  const fletchColor = opts.fletchColor ?? 0xf2f2f2;
  const fletchDark = Phaser.Display.Color.ValueToColor(fletchColor).clone().darken(20).color;

  const container = scene.add.container(0, 0);

  const nockY = -length * 0.5;
  const shaftTopY = -length * 0.4;
  const shaftBottomY = length * 0.32;
  const headTipY = length * 0.5;

  // Soft contact shadow for a touch of grounded depth.
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.16);
  shadow.fillEllipse(2, 4, thickness * 2.4, length * 0.85);
  container.add(shadow);

  // Wooden shaft: warm gradient + a couple of thin grain lines +
  // one bright highlight strip, instead of a flat brown rectangle.
  const shaft = scene.add.graphics();
  shaft.fillGradientStyle(0xd9a866, 0x8a5a2e, 0xc9955a, 0x6e4522, 1);
  shaft.fillRoundedRect(-thickness / 2, shaftTopY, thickness, shaftBottomY - shaftTopY, thickness / 2.2);
  shaft.lineStyle(0.8, 0x5c3a1a, 0.35);
  for (let i = -1; i <= 1; i++) {
    const gx = (i * thickness) / 3;
    shaft.beginPath();
    shaft.moveTo(gx, shaftTopY + 2);
    shaft.lineTo(gx + i * 1.5, shaftBottomY - 2);
    shaft.strokePath();
  }
  shaft.lineStyle(0.75, 0xf5e2bf, 0.45);
  shaft.beginPath();
  shaft.moveTo(-thickness * 0.16, shaftTopY + 2);
  shaft.lineTo(-thickness * 0.16, shaftBottomY - 2);
  shaft.strokePath();
  container.add(shaft);

  // Nock: dark notch at the very rear.
  const nock = scene.add.graphics();
  nock.fillStyle(0x2b2b2b, 1);
  nock.fillRoundedRect(-thickness * 0.55, nockY, thickness * 1.1, length * 0.08, 2);
  nock.lineStyle(1, 0x000000, 0.6);
  nock.beginPath();
  nock.moveTo(0, nockY);
  nock.lineTo(0, nockY + length * 0.04);
  nock.strokePath();
  container.add(nock);

  // Feather fletching: three feathers fanned around the shaft (two
  // slim side feathers + one larger center one) instead of one flat
  // triangle, for a soft, layered plume silhouette.
  const fletchLen = length * 0.22;
  const fletchY0 = shaftTopY - fletchLen * 0.1;
  const drawFeather = (offsetX: number, skew: number, scale: number, alpha: number) => {
    const g = scene.add.graphics();
    g.fillGradientStyle(fletchColor, fletchDark, fletchColor, fletchDark, alpha);
    g.beginPath();
    g.moveTo(offsetX, fletchY0);
    g.lineTo(offsetX + skew * scale, fletchY0 + fletchLen * scale * 0.35);
    g.lineTo(offsetX + skew * 0.3 * scale, fletchY0 + fletchLen * scale);
    g.lineTo(offsetX, fletchY0 + fletchLen * scale * 0.85);
    g.closePath();
    g.fillPath();
    g.lineStyle(0.75, 0x9a9a9a, 0.45);
    g.strokePath();
    container.add(g);
  };
  drawFeather(-thickness * 0.4, -9, 0.85, 0.7);
  drawFeather(thickness * 0.4, 9, 0.85, 0.7);
  drawFeather(0, 0, 1, 0.95);

  // Metallic arrowhead: elongated diamond with a gradient silver fill
  // and a thin bright edge to read as reflective metal.
  const head = scene.add.graphics();
  head.fillGradientStyle(0xf2f2f2, 0x8f8f8f, 0xd6d6d6, 0x6e6e6e, 1);
  head.beginPath();
  head.moveTo(0, headTipY);
  head.lineTo(thickness * 1.25, shaftBottomY + length * 0.04);
  head.lineTo(0, shaftBottomY - 2);
  head.lineTo(-thickness * 1.25, shaftBottomY + length * 0.04);
  head.closePath();
  head.fillPath();
  head.lineStyle(1, 0x4a4a4a, 0.5);
  head.strokePath();
  head.lineStyle(1, 0xffffff, 0.55);
  head.beginPath();
  head.moveTo(0, headTipY - 2);
  head.lineTo(0, shaftBottomY + 1);
  head.strokePath();
  container.add(head);

  return container;
}

function bezierPoints(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  segments = 16
) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    });
  }
  return pts;
}

function rotatePoint(p: { x: number; y: number }, deg: number) {
  const rad = Phaser.Math.DegToRad(deg);
  return {
    x: p.x * Math.cos(rad) - p.y * Math.sin(rad),
    y: p.x * Math.sin(rad) + p.y * Math.cos(rad),
  };
}

/**
 * Curved recurve-style bow, riser + wrapped grip + two bezier limbs.
 * Returns the tip points already rotated into the container's own
 * (unrotated) space so callers can draw a bowstring between them
 * without re-deriving the limb curve math.
 */
function buildBow(scene: Phaser.Scene, w: number, h: number, riserAngle: number) {
  const bowGroup = scene.add.container(w, h);
  bowGroup.setScrollFactor(0);
  bowGroup.setDepth(900);

  const riserH = h * 1.7;
  const gripW = w * 0.09;

  const rig = scene.add.container(0, 0);
  rig.setAngle(riserAngle);
  bowGroup.add(rig);

  // Riser / grip: wood gradient plus wrapped-grip stripes.
  const riser = scene.add.graphics();
  riser.fillGradientStyle(0x8a5a34, 0x4a2c17, 0x8a5a34, 0x4a2c17, 1);
  riser.fillRoundedRect(-gripW / 2, -riserH * 0.22, gripW, riserH * 0.44, gripW * 0.3);
  riser.lineStyle(2, 0x2e1c0f, 0.5);
  for (let i = -3; i <= 3; i++) {
    const y = (i * (riserH * 0.44)) / 7;
    riser.beginPath();
    riser.moveTo(-gripW / 2, y);
    riser.lineTo(gripW / 2, y + gripW * 0.35);
    riser.strokePath();
  }
  rig.add(riser);

  const limbTopStart = { x: 0, y: -riserH * 0.2 };
  const limbTopCtrl = { x: -gripW * 2.2, y: -riserH * 0.62 };
  const limbTopEnd = { x: -gripW * 1.3, y: -riserH * 0.98 };
  const limbBotStart = { x: 0, y: riserH * 0.2 };
  const limbBotCtrl = { x: -gripW * 2.2, y: riserH * 0.62 };
  const limbBotEnd = { x: -gripW * 1.3, y: riserH * 0.98 };

  const topPts = bezierPoints(limbTopStart, limbTopCtrl, limbTopEnd);
  const botPts = bezierPoints(limbBotStart, limbBotCtrl, limbBotEnd);

  const limbs = scene.add.graphics();
  const drawLimb = (pts: { x: number; y: number }[]) => {
    limbs.lineStyle(gripW * 0.5, 0x6b4226, 1);
    limbs.beginPath();
    limbs.moveTo(pts[0].x, pts[0].y);
    pts.forEach((p) => limbs.lineTo(p.x, p.y));
    limbs.strokePath();
    limbs.lineStyle(gripW * 0.18, 0xa87a4a, 0.55);
    limbs.beginPath();
    limbs.moveTo(pts[0].x - 1, pts[0].y - 1);
    pts.forEach((p) => limbs.lineTo(p.x - 1, p.y - 1));
    limbs.strokePath();
  };
  drawLimb(topPts);
  drawLimb(botPts);
  rig.add(limbs);

  const tipTop = rotatePoint(topPts[topPts.length - 1], riserAngle);
  const tipBot = rotatePoint(botPts[botPts.length - 1], riserAngle);

  return { bowGroup, tipTop, tipBot };
}

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
      // AUTO (WebGL, falling back to Canvas2D automatically if a
      // device genuinely can't do WebGL) instead of forcing CANVAS -
      // WebGL is what actually anti-aliases the bow's curved limbs
      // and the target rings; Canvas2D's shape edges are visibly
      // more jagged at this level of detail. No behavior or input
      // handling here depends on which renderer is active.
      type: Phaser.AUTO,
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
          // Measured directly from the production bg.jpg: the lane
          // lines converge at the archway at roughly (42%, 51%) of
          // the source image, not image-center. This is the real
          // horizon/vanishing point this photo has, so the target
          // needs to sit there or it visibly floats off the painted
          // path instead of sitting on it.
          const HORIZON_FRAC_X = 0.42;
          const HORIZON_FRAC_Y = 0.51;

          const project = (x: number, y: number, z: number) => {
            // Tiny idle sway/breathing (Priority 5) layered on top of
            // the real camera position at render time only - it never
            // touches the cameraX/Y registry values that the aim
            // preview, flight lerp, and shake logic all read/write, so
            // it can't drift the actual aim or trajectory math.
            const t = this.time.now * 0.001;
            const swayX = Math.sin(t * 0.6) * 1.6;
            const swayY = Math.sin(t * 0.9) * 1.1;
            const camX = this.registry.get("cameraX") + swayX;
            const camY = this.registry.get("cameraY") + swayY;
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

          // Target - hangs inside a wooden frame from a pole, rather
          // than resting on two ground legs (matches the reference:
          // a suspended target, not a tripod stand). The frame is
          // just one oversized wood-colored rectangle added *behind*
          // the target face - the face's own fill fully covers its
          // center, leaving a clean visible border ring around all
          // four edges, so there's only one extra shape to keep in
          // sync with TARGET_RADIUS if the ring sizing ever changes.
          const boardSize = TARGET_RADIUS * 2 + 60;
          const FRAME_BEAM = 20; // width of the visible wood border
          const FRAME_BEVEL = 8; // inset highlight strip, for a two-tone routed-edge look
          const frameOuterSize = boardSize + FRAME_BEAM * 2;
          const frameBevelSize = boardSize + FRAME_BEVEL * 2;

          // Soft drop shadow cast by the frame itself (a slightly
          // offset, translucent duplicate behind it - Phaser has no
          // blur filter for a plain rectangle, so this flat offset
          // reads as "cast a slight shadow" at this art style's level
          // of fidelity without pulling in a shader/plugin).
          const frameDropShadow = this.add.rectangle(
            6, 6, frameOuterSize, frameOuterSize, 0x000000, 0.22
          );
          targetGroup.add(frameDropShadow);

          const frameOuter = this.add.rectangle(0, 0, frameOuterSize, frameOuterSize, 0x6b4226);
          frameOuter.setStrokeStyle(2, 0x4a2c17, 0.9);
          targetGroup.add(frameOuter);

          const frameBevel = this.add.rectangle(0, 0, frameBevelSize, frameBevelSize, 0x8a5a34);
          targetGroup.add(frameBevel);

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

          // Printed ring-number guide along the right edge (10 at
          // center out to 1 at the outer ring) - visible in every shot
          // of the reference footage and a real cue for how close a
          // near-miss actually was, not just decoration.
          for (let i = 0; i < 10; i++) {
            const midRadius = TARGET_RADIUS - i * RING_WIDTH - RING_WIDTH / 2;
            const label = this.add
              .text(midRadius, 0, String(i + 1), {
                fontSize: "9px",
                fontFamily: "Inter, sans-serif",
                fontStyle: "700",
                color: i >= 6 ? "#3a2a00" : "#1a1a1a",
              })
              .setOrigin(0.5);
            targetGroup.add(label);
          }

          // Ground stand - four thin wooden legs propping the target up
          // from the grass. The earlier "hangs from a pole with a
          // pennant flag" mount was checked against a different
          // reference image; the actual gameplay footage (GamePigeon
          // Archery) consistently shows a simple 4-leg ground stand in
          // every round/distance shown, no pole, no flag - drawn behind
          // the frame (added first) so the frame face sits in front of
          // where the legs meet it.
          const legBottomY = frameOuterSize / 2 - 6;
          const legTopInset = frameOuterSize * 0.2;
          const legs = this.add.graphics();
          legs.lineStyle(7, 0x4a2c17, 1);
          [
            { topX: -legTopInset, spread: 0.85 },
            { topX: legTopInset, spread: 0.85 },
          ].forEach(({ topX, spread }) => {
            const botX = topX * spread * 1.6;
            const botY = legBottomY + frameOuterSize * 0.42;
            legs.beginPath();
            legs.moveTo(topX, legBottomY - 10);
            legs.lineTo(botX, botY);
            legs.strokePath();
            // Small crossbar near the ground for a sturdier, less
            // spindly stand silhouette.
            legs.lineStyle(4, 0x3d2417, 0.9);
            legs.beginPath();
            legs.moveTo(botX * 0.55, botY - 14);
            legs.lineTo(botX * 1.15, botY - 6);
            legs.strokePath();
            legs.lineStyle(7, 0x4a2c17, 1);
          });
          targetGroup.addAt(legs, 0);

          const targetShadow = this.add.ellipse(
            0, frameOuterSize / 2 + 22, frameOuterSize * 0.65, 26, 0x000000, 0.3
          );
          targetGroup.add(targetShadow);

          // Arrow (in flight) - only ever shown while a shot is
          // actually airborne. Projected through the same 3D camera
          // as the target, so its flight path visually agrees with
          // where the target sits.
          const arrowGroup = this.add.container(0, 0);
          this.registry.set("arrowGroup", arrowGroup);
          const realisticArrow = buildArrowGraphics(this, { length: 130, thickness: 6, fletchColor: initialMyColor });
          arrowGroup.add(realisticArrow);
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
          const RISER_ANGLE = -8;
          const { bowGroup, tipTop, tipBot } = buildBow(this, w, h, RISER_ANGLE);

          // Nock (fletching) rest position measured from the reference
          // photo at ~70% width / ~62% height, tip at ~64% width /
          // ~54% height - both expressed relative to the bottom-right
          // anchor so they scale with any canvas size. This stays a
          // real buildArrowGraphics() instance (Priority 3/4: same
          // arrow, always fully nocked, never a separate cheaper prop).
          const nockRestX = -w * 0.3;
          const nockRestY = -h * 0.38;

          // The arrow's rest angle is derived from the actual
          // nock->target vector, not a hand-tuned constant - a fixed
          // guess (previously 164deg) pointed the arrow almost
          // straight up with only a token leftward lean, because it
          // was never actually checked against where the target sits
          // on screen. The target's rest screen position is the
          // horizon/vanishing point (originX, originY) computed above
          // from the background photo itself - buildArrowGraphics's
          // local +y is the head/tip (see its doc comment), and at
          // rotation 0 that local +y points straight down in screen
          // space, so the rotation needed to aim it at (originX,
          // originY) is atan2(-dx, dy) where (dx,dy) is the
          // nock->target screen vector.
          const originXAbs = this.registry.get("originX") ?? cx;
          const originYAbs = this.registry.get("originY") ?? cy;
          const nockAbsX = w + nockRestX;
          const nockAbsY = h + nockRestY;
          const nockLeanAngle = Phaser.Math.RadToDeg(
            Math.atan2(-(originXAbs - nockAbsX), originYAbs - nockAbsY)
          );

          const nockedArrow = buildArrowGraphics(this, {
            length: w * 0.42,
            thickness: 6,
            fletchColor: initialMyColor,
          });
          nockedArrow.setPosition(nockRestX, nockRestY);
          nockedArrow.setAngle(nockLeanAngle);
          bowGroup.add(nockedArrow);

          const bowString = this.add.graphics();
          bowGroup.addAt(bowString, bowGroup.list.indexOf(nockedArrow)); // string drawn just behind the nocked arrow

          const redrawBowString = (nockX: number, nockY: number) => {
            bowString.clear();
            bowString.lineStyle(1.5, 0xe8e4da, 0.85);
            bowString.beginPath();
            bowString.moveTo(tipTop.x, tipTop.y);
            bowString.lineTo(nockX, nockY - 4);
            bowString.lineTo(tipBot.x, tipBot.y);
            bowString.strokePath();
          };
          redrawBowString(nockRestX, nockRestY);

          this.registry.set("bowGroup", bowGroup);
          this.registry.set("nockedArrow", nockedArrow);
          this.registry.set("nockRestX", nockRestX);
          this.registry.set("nockRestY", nockRestY);
          this.registry.set("nockLeanAngle", nockLeanAngle);
          this.registry.set("redrawBowString", redrawBowString);

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
          this.registry.set("reticleRing", reticleRing);
          this.registry.set("reticleDot", reticleDot);

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
          const windBoxX = this.registry.get("originX") ?? cx;
          const windBoxY = h * 0.34;

          const windBg = this.add.rectangle(windBoxX, windBoxY, windBoxW, windBoxH, 0x000000, 0.45);
          windBg.setStrokeStyle(2, 0xef4444, 0.9);
          windBg.setScrollFactor(0);
          windBg.setDepth(950);

          const windSplitX = windBoxX - windBoxW * 0.06;

          const windLabel = this.add
            .text(windSplitX - 6, windBoxY, "WIND:", {
              fontSize: "16px",
              fontFamily: "Inter, sans-serif",
              fontStyle: "800",
              color: "#ffffff",
            })
            .setOrigin(1, 0.5);
          windLabel.setScrollFactor(0);
          windLabel.setDepth(951);

          const windValue = this.add
            .text(windSplitX + 6, windBoxY, "0.0", {
              fontSize: "16px",
              fontFamily: "Inter, sans-serif",
              fontStyle: "900",
              color: "#ef4444",
            })
            .setOrigin(0, 0.5);
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
          if (bowGroup) {
            // The sway inside project() (above) only ever reached
            // world-projected objects - target, flying arrow,
            // trajectory dots - because the bow is a screen-space HUD
            // element (setScrollFactor(0)) positioned directly here,
            // not run through project() at all. That left the one
            // thing you're actually holding perfectly static. This is
            // a separate, independent sway on bowGroup itself, paused
            // during the brief flight animation (bowGroup is hidden
            // then anyway) so it can never fight the release
            // recoil/flight motion.
            if (!shootingRef.current) {
              const swayT = this.time.now * 0.0011;
              bowGroup.setPosition(w + Math.sin(swayT) * 2.4, h + Math.cos(swayT * 0.8) * 1.7);
              bowGroup.angle = Math.sin(swayT * 0.55) * 0.55;
            } else {
              bowGroup.setPosition(w, h);
              bowGroup.angle = 0;
            }
          }

          const reticle = this.registry.get("reticle") as Phaser.GameObjects.Container;
          const reticleRing = this.registry.get("reticleRing") as Phaser.GameObjects.Arc | undefined;
          const reticleDot = this.registry.get("reticleDot") as Phaser.GameObjects.Arc | undefined;
          const reticleTarget = this.registry.get("reticleTarget");
          if (reticle && reticleTarget) {
            // Miss-case predictions carry their own z (wherever the
            // arc actually ends up); a clean-hit prediction has no z
            // and projects against the target's own plane instead -
            // see updatePreview()'s two branches above.
            const p = project(reticleTarget.x, reticleTarget.y, reticleTarget.z ?? targetZ);
            if (p.visible) {
              reticle.setPosition(p.x, p.y);
              reticle.setScale(Math.max(0.3, p.scale));
              reticle.visible = true;
              const color = reticleTarget.onTarget ? 0xffd166 : 0xef4444;
              if (reticleRing) reticleRing.setStrokeStyle(2, color, 0.9);
              if (reticleDot) reticleDot.setFillStyle(color, 1);
            } else {
              reticle.visible = false;
            }
          } else if (reticle) {
            // Explicitly hidden rather than left at whatever it was
            // last frame - previously this branch didn't exist, so a
            // reticle left visible from a hit prediction could stick
            // around after the very next frame's draw predicted a
            // miss (reticleTarget briefly null before the miss-case
            // fallback above existed).
            reticle.visible = false;
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
      const shadow = scene.add.ellipse(2, 4, 26, 12, 0x000000, 0.35);
      // Planted embedded-in-target look: head buried (rotated to
      // point straight in), only the rear third of the shaft and the
      // fletching visible above the surface.
      const arrow = buildArrowGraphics(scene, { length: 70, thickness: 5, fletchColor: color });
      arrow.setPosition(0, -8);
      group.add([shadow, arrow]);
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
      const nockedArrow = scene.registry.get("nockedArrow") as Phaser.GameObjects.Container | undefined;
      const nockRestX = scene.registry.get("nockRestX");
      const nockRestY = scene.registry.get("nockRestY");
      const nockLeanAngle = scene.registry.get("nockLeanAngle");
      const redrawBowString = scene.registry.get("redrawBowString") as
        | ((x: number, y: number) => void)
        | undefined;
      if (nockedArrow && nockRestX !== undefined) {
        nockedArrow.setPosition(nockRestX, nockRestY);
        nockedArrow.setAngle(nockLeanAngle);
      }
      if (redrawBowString) redrawBowString(nockRestX, nockRestY);
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

      // Previously only showed the reticle when this exact draw was
      // predicted to land a clean hit (result.hit), which meant most
      // of a normal drag - anything short of a fully dialed-in pull -
      // showed no reticle at all. Now it always tracks *something*:
      // the real predicted impact point for a hit, or the arc's own
      // last sampled point (still real simulateTrajectory output, not
      // invented) for a shot that would currently fall short/miss -
      // same continuous "this is where it's headed" feedback real
      // archery games give throughout the whole draw, not only once
      // you happen to be dialed in.
      if (result.hit) {
        // No z here deliberately - finalX/finalY are already relative
        // to the target's own center at its plane, so update() should
        // project them against targetZ (see the fallback there), not
        // a z value from this scope.
        scene.registry.set("reticleTarget", { x: result.finalX, y: -result.finalY, onTarget: true });
      } else {
        const last = result.path[result.path.length - 1];
        scene.registry.set(
          "reticleTarget",
          last ? { x: last.x, y: -last.y, z: last.z, onTarget: false } : null
        );
      }
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

      // Foreground bow: slide the nocked arrow (and the string it's
      // attached to) backward along the draw as power charges, and
      // let it drift slightly with the aim drag - purely cosmetic,
      // reads directly off the same pullPower/aimAngle locals the
      // preview/shot use, never a separate source of truth.
      const nockedArrow = scene.registry.get("nockedArrow") as Phaser.GameObjects.Container | undefined;
      const nockRestX = scene.registry.get("nockRestX");
      const nockRestY = scene.registry.get("nockRestY");
      const nockLeanAngle = scene.registry.get("nockLeanAngle");
      const redrawBowString = scene.registry.get("redrawBowString") as
        | ((x: number, y: number) => void)
        | undefined;
      if (nockedArrow && nockRestX !== undefined) {
        const drawT = pullPower / MAX_POWER;
        const nx = nockRestX + drawT * 26 + aimAngleX * 40;
        const ny = nockRestY + drawT * 22 + aimAngleY * 20;
        nockedArrow.setPosition(nx, ny);
        nockedArrow.setAngle(nockLeanAngle - aimAngleX * 25);
        if (redrawBowString) redrawBowString(nx, ny);
      }

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

      // Small recoil kick (Priority 5): a quick pullback right at
      // release that the per-frame forward lerp below immediately
      // starts smoothing back out, reading as "shot released, camera
      // settles forward" rather than an instant cut.
      const camZAtRelease = scene.registry.get("cameraZ");
      scene.registry.set("cameraZ", camZAtRelease - 14);

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

            // Callout appears at the arrow's actual landing spot on the
            // target, not a fixed screen position - matches the
            // reference (the "+10" pops up right where the shot hit).
            // targetGroup's x/y/scale are re-projected from the same
            // camera every frame in update(), the identical transform
            // already used to plant each past shot's arrow, so this
            // stays correct even mid-camera-shake.
            const targetGroup = scene.registry.get("targetGroup") as Phaser.GameObjects.Container | undefined;
            let calloutX = scene.scale.width / 2;
            let calloutY = scene.scale.height / 2 - 100;
            if (targetGroup) {
              if (result.hit) {
                calloutX = targetGroup.x + result.finalX * targetGroup.scaleX;
                calloutY = targetGroup.y + -result.finalY * targetGroup.scaleY;
              } else {
                // No on-target landing point for a miss - anchor just
                // above the target itself rather than screen-center.
                calloutX = targetGroup.x;
                calloutY = targetGroup.y - 60;
              }
            }
            scoreText.setPosition(calloutX, calloutY);
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
            {Math.round(state.target_dist * 20)}ft
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
