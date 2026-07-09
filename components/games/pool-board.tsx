"use client";

import { useEffect, useRef, useState } from "react";
import type { PoolBall, PoolState } from "@/types/pool";
import {
  BALL_RADIUS,
  POCKETS,
  POCKET_RADIUS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
} from "@/types/pool";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";

// ---------------------------------------------------------------------------
// Layout constants (canvas/pixel space).
//
// types/pool.ts's coordinate space is a flat 800x400 playing surface with
// (0,0) at the top-left of the felt - that's exactly what the server engine
// and every other client reason about. RAIL is the wooden cushion border we
// draw *around* that purely for rendering/physics-wall purposes; the server
// never needs to know it exists. toCanvas/toTable are the only two places
// that translate between the two spaces, so nothing else has to think about
// the offset.
// ---------------------------------------------------------------------------
const RAIL = 34;
const CUSHION_THK = 22;
const CANVAS_W = TABLE_WIDTH + RAIL * 2;
const CANVAS_H = TABLE_HEIGHT + RAIL * 2;

function toCanvas(x: number, y: number) {
  return { x: x + RAIL, y: y + RAIL };
}
function toTable(x: number, y: number) {
  return { x: x - RAIL, y: y - RAIL };
}

// Standard American 8-ball numbering/coloring. Stripes (9-15) reuse their
// solid counterpart's color (9 = same color family as 1, etc.) but are drawn
// as a white ball with a colored ring instead of a fully filled one.
const BALL_COLOR: Record<number, number> = {
  1: 0xe8c53a, 9: 0xe8c53a,
  2: 0x1c4fd6, 10: 0x1c4fd6,
  3: 0xd6291c, 11: 0xd6291c,
  4: 0x7a1cd6, 12: 0x7a1cd6,
  5: 0xe8791a, 13: 0xe8791a,
  6: 0x1a9e4b, 14: 0x1a9e4b,
  7: 0x7a1c1c, 15: 0x7a1c1c,
};

// Pull the pointer back up to this many px from the cue ball for full power.
const MAX_DRAG = 130;
// Matter velocity units/step applied to the cue ball at full power.
const MAX_SPEED = 27;
// Below this speed (all balls) a shot is considered "settled".
const SETTLE_SPEED = 0.05;
// How many consecutive slow frames before we actually call it settled -
// avoids finalizing on a single lucky quiet frame mid-collision.
const SETTLE_FRAMES_NEEDED = 40;
// Failsafe so a pathological shot (balls endlessly grazing a cushion at
// near-zero speed) can't hang the UI forever.
const MAX_SIM_MS = 9000;

type FinalPosition = { id: number; x: number; y: number; pocketed: boolean };

interface SettledResult {
  final_positions: FinalPosition[];
  first_contact_ball_id: number | null;
  cue_pocketed: boolean;
}

interface Props {
  matchId: string;
  userId: string;
}

export default function PoolBoard({ matchId, userId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const sceneRef = useRef<import("phaser").Scene | null>(null);
  // Mirrors `shooting` state into a ref so the realtime/poll callbacks
  // (registered once, long-lived closures) always see the current value
  // instead of whatever it was when they were created.
  const shootingRef = useRef(false);

  const [state, setState] = useState<PoolState | null>(null);
  const [error, setError] = useState("");
  const [foulNotice, setFoulNotice] = useState("");
  const [shooting, setShooting] = useState(false);
  const { play } = useSound();

  async function loadState() {
    try {
      const res = await fetch(`/api/pool/state?match_id=${matchId}`);
      const json = await res.json();
      if (json.success) setState(json.match.game_state as PoolState);
    } catch {
      /* next poll/realtime event will retry */
    }
  }

  useEffect(() => {
    loadState();
    // Realtime keeps this instant; the slow poll is only a fallback in
    // case a realtime event is ever missed, matching the pattern used by
    // every other board in game-client.tsx.
    const interval = setInterval(loadState, 12000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useMatchRealtime(matchId, (row) => {
    // While we're mid-simulation of our *own* shot, the scene owns the
    // table (physics is running locally, live positions haven't been
    // reported to the server yet) - a stray poll/realtime update landing
    // here is always a stale view of the pre-shot table and must not be
    // allowed to reset the board out from under the running simulation.
    if (shootingRef.current) return;
    if (row.game_state) setState(row.game_state as PoolState);
  });

  // -------------------------------------------------------------------
  // Phaser + Matter.js setup. One-time on mount.
  // -------------------------------------------------------------------
  useEffect(() => {
    let destroyed = false;
    let resizeObserver: ResizeObserver | null = null;

    import("phaser")
      .then((Phaser) => {
        if (destroyed || !containerRef.current || gameRef.current) return;
        try {
          class BoardScene extends Phaser.Scene {
            constructor() {
              super("board");
            }

            // Idle/"display" mode - plain (non-physics) visuals reflecting
            // the last known authoritative server state.
            currentBalls: PoolBall[] = [];
            displayObjs = new Map<number, Phaser.GameObjects.Container>();
            lastCanvasPos = new Map<number, { x: number; y: number }>();
            cueBallObj: Phaser.GameObjects.Container | null = null;

            placementEnabled = false;
            aimEnabled = false;
            aiming = false;
            aimPivot = { x: 0, y: 0 };
            aimGraphics!: Phaser.GameObjects.Graphics;

            // "Simulate" mode - a real Matter.js physics pass for the shot
            // the local player just fired. Only ever runs on the shooter's
            // own client; see the note in supabase/migrations/
            // 064_eight_ball_pool.sql about why there's no server replay.
            simulating = false;
            simBodies = new Map<number, Phaser.GameObjects.Container>();
            simFirstContact: number | null = null;
            simPocketedIds = new Set<number>();
            simPocketedPos = new Map<number, { x: number; y: number }>();
            simCuePocketed = false;
            simSettleCounter = 0;
            simStartTime = 0;

            onSettled?: (result: SettledResult) => void;
            onShotStarted?: () => void;
            onBallPocketed?: (id: number) => void;

            create() {
              sceneRef.current = this;
              this.aimGraphics = this.add.graphics();
              this.drawTable();
              this.setupCushionsAndPockets();

              // Global pointer handling drives the "drag away from the cue
              // ball to aim, release to shoot" gesture. If the pointerdown
              // actually landed on the cue ball while it's the local
              // player's ball-in-hand (draggable), let Phaser's own drag
              // handling below own that gesture instead of starting an aim.
              this.input.on(
                "pointerdown",
                (pointer: Phaser.Input.Pointer, objs: Phaser.GameObjects.GameObject[] = []) => {
                  if (!this.aimEnabled || this.simulating) return;
                  if (
                    this.placementEnabled &&
                    this.cueBallObj &&
                    objs.includes(this.cueBallObj)
                  ) {
                    return;
                  }
                  this.startAim(pointer);
                },
              );
              this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
                if (this.aiming) this.updateAim(pointer);
              });
              this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
                if (this.aiming) this.finishAim(pointer);
              });

              this.matter.world.on(
                "collisionstart",
                (event: MatterJS.IEventCollision<MatterJS.Engine>) =>
                  this.handleCollision(event),
              );
            }

            // ---- Static table dressing --------------------------------
            drawTable() {
              const g = this.add.graphics();
              // Wooden outer frame.
              g.fillStyle(0x5c3a21, 1);
              g.fillRect(0, 0, CANVAS_W, CANVAS_H);
              // Felt playing surface.
              g.fillStyle(0x0b5c3a, 1);
              g.fillRect(RAIL, RAIL, TABLE_WIDTH, TABLE_HEIGHT);
              g.lineStyle(2, 0x0a4a2f, 1);
              g.strokeRect(RAIL, RAIL, TABLE_WIDTH, TABLE_HEIGHT);

              // Cushions (visual only - matching invisible Matter bodies
              // are added in setupCushionsAndPockets). Six segments, split
              // around each pocket so the felt visibly opens into a hole.
              g.fillStyle(0x0e7a4d, 1);
              for (const c of this.cushionRects()) {
                g.fillRoundedRect(
                  c.x - c.w / 2,
                  c.y - c.h / 2,
                  c.w,
                  c.h,
                  4,
                );
              }

              // Pockets - drawn last so they sit on top of both the felt
              // and the cushion ends.
              g.fillStyle(0x000000, 1);
              for (const p of POCKETS) {
                const { x, y } = toCanvas(p.x, p.y);
                g.fillCircle(x, y, POCKET_RADIUS);
              }
            }

            cushionRects() {
              const left = RAIL;
              const right = RAIL + TABLE_WIDTH;
              const top = RAIL;
              const bottom = RAIL + TABLE_HEIGHT;
              const midX = RAIL + TABLE_WIDTH / 2;
              const gap = POCKET_RADIUS;
              return [
                { x: (left + gap + midX - gap) / 2, y: top - CUSHION_THK / 2, w: midX - gap - (left + gap), h: CUSHION_THK },
                { x: (midX + gap + right - gap) / 2, y: top - CUSHION_THK / 2, w: right - gap - (midX + gap), h: CUSHION_THK },
                { x: (left + gap + midX - gap) / 2, y: bottom + CUSHION_THK / 2, w: midX - gap - (left + gap), h: CUSHION_THK },
                { x: (midX + gap + right - gap) / 2, y: bottom + CUSHION_THK / 2, w: right - gap - (midX + gap), h: CUSHION_THK },
                { x: left - CUSHION_THK / 2, y: (top + gap + bottom - gap) / 2, w: CUSHION_THK, h: bottom - gap - (top + gap) },
                { x: right + CUSHION_THK / 2, y: (top + gap + bottom - gap) / 2, w: CUSHION_THK, h: bottom - gap - (top + gap) },
              ];
            }

            setupCushionsAndPockets() {
              for (const c of this.cushionRects()) {
                this.matter.add.rectangle(c.x, c.y, c.w, c.h, {
                  isStatic: true,
                  restitution: 0.75,
                  friction: 0.02,
                  label: "cushion",
                });
              }
              POCKETS.forEach((p, i) => {
                const { x, y } = toCanvas(p.x, p.y);
                this.matter.add.circle(x, y, POCKET_RADIUS * 0.85, {
                  isStatic: true,
                  isSensor: true,
                  label: `pocket-${i}`,
                });
              });
            }

            // ---- Ball visuals ------------------------------------------
            makeBallVisual(ball: PoolBall) {
              const container = this.add.container(0, 0);
              const isStripe = ball.type === "stripe";
              const color =
                ball.type === "cue"
                  ? 0xffffff
                  : ball.type === "eight"
                    ? 0x111111
                    : (BALL_COLOR[ball.id] ?? 0x999999);

              if (isStripe) {
                const base = this.add.circle(0, 0, BALL_RADIUS, 0xffffff);
                base.setStrokeStyle(3.5, color, 1);
                container.add(base);
              } else {
                const base = this.add.circle(0, 0, BALL_RADIUS, color);
                base.setStrokeStyle(1, 0x000000, 0.35);
                container.add(base);
              }

              if (ball.type !== "cue") {
                const label = this.add
                  .text(0, 0, String(ball.id), {
                    fontSize: "9px",
                    fontStyle: "bold",
                    color: isStripe ? `#${color.toString(16).padStart(6, "0")}` : "#ffffff",
                  })
                  .setOrigin(0.5);
                container.add(label);
              }
              return container;
            }

            // ---- Idle/display mode --------------------------------------
            renderBalls(balls: PoolBall[]) {
              this.currentBalls = balls;
              const seen = new Set<number>();

              balls.forEach((b) => {
                seen.add(b.id);
                if (b.pocketed) {
                  const existing = this.displayObjs.get(b.id);
                  if (existing) {
                    existing.destroy();
                    this.displayObjs.delete(b.id);
                  }
                  return;
                }
                const target = toCanvas(b.x, b.y);
                let obj = this.displayObjs.get(b.id);
                if (!obj) {
                  obj = this.makeBallVisual(b);
                  obj.setPosition(target.x, target.y);
                  this.displayObjs.set(b.id, obj);
                } else {
                  const from = this.lastCanvasPos.get(b.id) ?? target;
                  if (from.x !== target.x || from.y !== target.y) {
                    this.tweens.add({
                      targets: obj,
                      x: target.x,
                      y: target.y,
                      duration: 450,
                      ease: "Cubic.Out",
                    });
                  } else {
                    obj.setPosition(target.x, target.y);
                  }
                }
                this.lastCanvasPos.set(b.id, target);
                if (b.id === 0) this.cueBallObj = obj;
              });

              // Clean up any display objects for balls no longer present
              // (shouldn't normally happen, but keep this robust).
              for (const [id, obj] of this.displayObjs) {
                if (!seen.has(id)) {
                  obj.destroy();
                  this.displayObjs.delete(id);
                }
              }

              if (this.cueBallObj) this.setupCueDrag();
            }

            setupCueDrag() {
              if (!this.cueBallObj) return;
              this.cueBallObj.setSize(BALL_RADIUS * 2, BALL_RADIUS * 2);
              this.cueBallObj.setInteractive({ useHandCursor: true });
              this.input.setDraggable(this.cueBallObj, this.placementEnabled);
              this.cueBallObj.off("drag");
              this.cueBallObj.on(
                "drag",
                (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
                  if (!this.placementEnabled || !this.cueBallObj) return;
                  const clamped = this.clampToTable(dragX, dragY);
                  this.cueBallObj.setPosition(clamped.x, clamped.y);
                  this.lastCanvasPos.set(0, clamped);
                },
              );
            }

            clampToTable(x: number, y: number) {
              const minX = RAIL + BALL_RADIUS + 1;
              const maxX = RAIL + TABLE_WIDTH - BALL_RADIUS - 1;
              const minY = RAIL + BALL_RADIUS + 1;
              const maxY = RAIL + TABLE_HEIGHT - BALL_RADIUS - 1;
              return {
                x: Math.min(maxX, Math.max(minX, x)),
                y: Math.min(maxY, Math.max(minY, y)),
              };
            }

            setPlacementEnabled(enabled: boolean) {
              this.placementEnabled = enabled;
              if (this.cueBallObj) {
                this.input.setDraggable(this.cueBallObj, enabled);
              }
            }

            setAimEnabled(enabled: boolean) {
              this.aimEnabled = enabled;
              if (!enabled) {
                this.aiming = false;
                this.aimGraphics.clear();
              }
            }

            // ---- Aiming ---------------------------------------------------
            startAim(pointer: Phaser.Input.Pointer) {
              if (!this.cueBallObj) return;
              this.aiming = true;
              this.aimPivot = { x: this.cueBallObj.x, y: this.cueBallObj.y };
              this.updateAim(pointer);
            }

            updateAim(pointer: Phaser.Input.Pointer) {
              const dx = pointer.x - this.aimPivot.x;
              const dy = pointer.y - this.aimPivot.y;
              const dist = Math.min(MAX_DRAG, Math.hypot(dx, dy));
              const angle = Math.atan2(dy, dx);
              const power = dist / MAX_DRAG;

              const pullX = this.aimPivot.x + Math.cos(angle) * dist;
              const pullY = this.aimPivot.y + Math.sin(angle) * dist;
              // The shot travels opposite the pull-back direction.
              const aimLen = 260;
              const aimX = this.aimPivot.x - Math.cos(angle) * aimLen;
              const aimY = this.aimPivot.y - Math.sin(angle) * aimLen;

              const g = this.aimGraphics;
              g.clear();
              if (dist > 4) {
                // Projected path (dotted).
                g.lineStyle(2, 0xffffff, 0.55);
                const steps = 14;
                for (let i = 0; i < steps; i++) {
                  const t0 = i / steps;
                  const t1 = (i + 0.5) / steps;
                  g.beginPath();
                  g.moveTo(
                    this.aimPivot.x + (aimX - this.aimPivot.x) * t0,
                    this.aimPivot.y + (aimY - this.aimPivot.y) * t0,
                  );
                  g.lineTo(
                    this.aimPivot.x + (aimX - this.aimPivot.x) * t1,
                    this.aimPivot.y + (aimY - this.aimPivot.y) * t1,
                  );
                  g.strokePath();
                }
                // Cue stick, pulled back.
                g.lineStyle(5, 0xd8b48a, 0.95);
                g.beginPath();
                g.moveTo(pullX, pullY);
                g.lineTo(
                  pullX + Math.cos(angle) * 90,
                  pullY + Math.sin(angle) * 90,
                );
                g.strokePath();
                // Power indicator ring around the cue ball.
                g.lineStyle(3, power > 0.85 ? 0xff5555 : 0xffd166, 0.9);
                g.strokeCircle(this.aimPivot.x, this.aimPivot.y, BALL_RADIUS + 6 + power * 10);
              }
            }

            finishAim(pointer: Phaser.Input.Pointer) {
              this.aiming = false;
              this.aimGraphics.clear();
              const dx = pointer.x - this.aimPivot.x;
              const dy = pointer.y - this.aimPivot.y;
              const dist = Math.min(MAX_DRAG, Math.hypot(dx, dy));
              if (dist < 12) return; // treat as a cancelled tap, not a shot

              const angle = Math.atan2(dy, dx);
              const power = dist / MAX_DRAG;
              const dir = { x: -Math.cos(angle), y: -Math.sin(angle) };
              this.runSimulation(dir, power);
            }

            // ---- Physics simulation of the local shot ---------------------
            runSimulation(dir: { x: number; y: number }, power: number) {
              this.setAimEnabled(false);
              this.setPlacementEnabled(false);
              this.simulating = true;
              this.simFirstContact = null;
              this.simPocketedIds = new Set();
              this.simPocketedPos = new Map();
              this.simCuePocketed = false;
              this.simSettleCounter = 0;
              this.simStartTime = performance.now();
              this.simBodies = new Map();

              // Tear down the idle display objects and rebuild the same
              // balls as Matter-physics bodies at their current positions.
              for (const obj of this.displayObjs.values()) obj.destroy();
              this.displayObjs.clear();

              this.currentBalls.forEach((b) => {
                if (b.pocketed) return;
                const pos =
                  b.id === 0 && this.lastCanvasPos.has(0)
                    ? this.lastCanvasPos.get(0)!
                    : toCanvas(b.x, b.y);
                const visual = this.makeBallVisual(b);
                visual.setPosition(pos.x, pos.y);
                const body = this.matter.add.gameObject(visual, {
                  shape: { type: "circle", radius: BALL_RADIUS },
                  restitution: 0.92,
                  friction: 0.06,
                  frictionAir: 0.017,
                  label: `ball-${b.id}`,
                }) as unknown as Phaser.GameObjects.Container;
                this.simBodies.set(b.id, body);
              });

              const cueBody = this.simBodies.get(0);
              if (cueBody) {
                const speed = power * MAX_SPEED;
                (cueBody as unknown as { setVelocity: (x: number, y: number) => void }).setVelocity(
                  dir.x * speed,
                  dir.y * speed,
                );
              }

              this.onShotStarted?.();
            }

            handleCollision(event: MatterJS.IEventCollision<MatterJS.Engine>) {
              if (!this.simulating) return;
              for (const pair of event.pairs) {
                const bodyA = pair.bodyA as unknown as { label?: string };
                const bodyB = pair.bodyB as unknown as { label?: string };
                const la = bodyA.label ?? "";
                const lb = bodyB.label ?? "";

                const ballIdA = la.startsWith("ball-") ? Number(la.slice(5)) : null;
                const ballIdB = lb.startsWith("ball-") ? Number(lb.slice(5)) : null;

                if (ballIdA !== null && ballIdB !== null && this.simFirstContact === null) {
                  // Only the cue ball is ever moving at t=0, so the very
                  // first ball-ball collision of a shot always involves it -
                  // record whichever side of the pair isn't the cue.
                  if (ballIdA === 0) this.simFirstContact = ballIdB;
                  else if (ballIdB === 0) this.simFirstContact = ballIdA;
                }

                const pocketLabel = la.startsWith("pocket-") ? la : lb.startsWith("pocket-") ? lb : null;
                const potentialBallId = la.startsWith("pocket-") ? ballIdB : ballIdA;
                if (pocketLabel !== null && potentialBallId !== null && !this.simPocketedIds.has(potentialBallId)) {
                  this.pocketBall(potentialBallId);
                }
              }
            }

            pocketBall(id: number) {
              this.simPocketedIds.add(id);
              if (id === 0) this.simCuePocketed = true;
              this.onBallPocketed?.(id);
              const body = this.simBodies.get(id);
              if (body) {
                // Remember where it went in (table-space) so
                // finalizeSimulation can still report a plausible "near a
                // pocket" position for it, even though the body itself is
                // about to be removed from the world.
                this.simPocketedPos.set(id, toTable(body.x, body.y));
                const matterBody = (body as unknown as { body: MatterJS.BodyType }).body;
                this.matter.world.remove(matterBody);
                this.tweens.add({
                  targets: body,
                  alpha: 0,
                  scale: 0.4,
                  duration: 220,
                  onComplete: () => body.destroy(),
                });
                this.simBodies.delete(id);
              }
            }

            update() {
              if (!this.simulating) return;
              const elapsed = performance.now() - this.simStartTime;
              let maxSpeed = 0;
              for (const body of this.simBodies.values()) {
                const mb = (body as unknown as { body: MatterJS.BodyType }).body;
                if (!mb) continue;
                const v = Math.hypot(mb.velocity.x, mb.velocity.y);
                if (v > maxSpeed) maxSpeed = v;
              }

              if (maxSpeed < SETTLE_SPEED) {
                this.simSettleCounter += 1;
              } else {
                this.simSettleCounter = 0;
              }

              if (this.simSettleCounter >= SETTLE_FRAMES_NEEDED || elapsed > MAX_SIM_MS) {
                this.finalizeSimulation();
              }
            }

            finalizeSimulation() {
              this.simulating = false;

              const final: FinalPosition[] = [];
              // Balls that were already pocketed before this shot started
              // stay exactly as they were - the server only cares that
              // pocketed:true entries are near a pocket, which was already
              // true.
              this.currentBalls.forEach((b) => {
                if (b.pocketed && b.id !== 0) {
                  final.push({ id: b.id, x: b.x, y: b.y, pocketed: true });
                }
              });

              // Balls newly pocketed *during* this shot - report the
              // position they were at when they fell in (simPocketedPos),
              // which is guaranteed to be near that pocket.
              for (const id of this.simPocketedIds) {
                if (id === 0) continue; // cue is handled separately below
                const pos = this.simPocketedPos.get(id);
                if (pos) final.push({ id, x: pos.x, y: pos.y, pocketed: true });
              }

              // Everything still resting on the table at the end of the
              // shot (was never pocketed, pre-existing or new).
              for (const [id, body] of this.simBodies) {
                const table = toTable(body.x, body.y);
                final.push({ id, x: table.x, y: table.y, pocketed: false });
              }

              // Cue-ball scratch handling: the server models a foul via the
              // separate `cue_pocketed` flag, not by permanently removing
              // the cue ball (there is no "un-pocket" in the engine) - see
              // ShotSubmission in types/pool.ts. So on a scratch we respot
              // the cue ball onto the table (nudged clear of any resting
              // ball) and report it as NOT pocketed, exactly like a normal
              // resting ball, while still flagging cue_pocketed separately.
              if (this.simCuePocketed) {
                const respot = this.findRespot(final);
                final.push({ id: 0, x: respot.x, y: respot.y, pocketed: false });
              }

              const result: SettledResult = {
                final_positions: final,
                first_contact_ball_id: this.simFirstContact,
                cue_pocketed: this.simCuePocketed,
              };

              // Show the resting layout immediately (as plain display
              // objects) rather than leaving the table blank while we wait
              // on the network round-trip to the server.
              const previewBalls: PoolBall[] = this.currentBalls.map((b) => {
                const f = final.find((p) => p.id === b.id);
                if (!f) return b;
                return { ...b, x: f.x, y: f.y, pocketed: f.pocketed };
              });
              for (const body of this.simBodies.values()) body.destroy();
              this.simBodies.clear();
              this.renderBalls(previewBalls);

              this.onSettled?.(result);
            }

            findRespot(final: FinalPosition[]): { x: number; y: number } {
              const headX = TABLE_WIDTH * 0.25;
              const headY = TABLE_HEIGHT / 2;
              const candidates: { x: number; y: number }[] = [
                { x: headX, y: headY },
                { x: TABLE_WIDTH * 0.5, y: TABLE_HEIGHT / 2 },
                { x: TABLE_WIDTH * 0.15, y: TABLE_HEIGHT * 0.25 },
                { x: TABLE_WIDTH * 0.15, y: TABLE_HEIGHT * 0.75 },
              ];
              for (const c of candidates) {
                const clear = final.every(
                  (p) => p.pocketed || Math.hypot(p.x - c.x, p.y - c.y) > BALL_RADIUS * 2.2,
                );
                if (clear) return c;
              }
              return candidates[0];
            }
          }

          const game = new Phaser.Game({
            type: Phaser.CANVAS,
            width: CANVAS_W,
            height: CANVAS_H,
            parent: containerRef.current,
            backgroundColor: "#0b3d2e",
            physics: {
              default: "matter",
              matter: {
                gravity: { x: 0, y: 0 },
                debug: false,
              },
            },
            scene: BoardScene,
            // FIT scales this fixed-resolution canvas down to whatever the
            // container's actual width is, same reasoning as ludo-board.tsx.
            scale: {
              mode: Phaser.Scale.FIT,
              autoCenter: Phaser.Scale.CENTER_BOTH,
              width: CANVAS_W,
              height: CANVAS_H,
            },
          });

          gameRef.current = game;

          resizeObserver = new ResizeObserver(() => {
            gameRef.current?.scale.refresh();
          });
          resizeObserver.observe(containerRef.current);
        } catch (err) {
          console.error("Pool board failed to initialize:", err);
          setError("Board failed to load — please refresh the page.");
        }
      })
      .catch((err) => {
        console.error("Failed to load Phaser:", err);
        setError("Board failed to load — please refresh the page.");
      });

    return () => {
      destroyed = true;
      resizeObserver?.disconnect();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------------
  // Sync scene with the latest authoritative state.
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!state || !sceneRef.current) return;
    if (shootingRef.current) return; // scene owns the table mid-shot

    const scene = sceneRef.current as unknown as {
      renderBalls: (balls: PoolBall[]) => void;
      setPlacementEnabled: (v: boolean) => void;
      setAimEnabled: (v: boolean) => void;
      onSettled?: (result: SettledResult) => void;
      onShotStarted?: () => void;
      onBallPocketed?: (id: number) => void;
    };

    const mySeat =
      state.a_player_id === userId ? "A" : state.b_player_id === userId ? "B" : null;
    const isMyTurn = mySeat !== null && state.current_turn === mySeat && !state.game_over;
    const ballInHandMine = mySeat !== null && state.ball_in_hand === mySeat;

    scene.renderBalls(state.balls);
    scene.setPlacementEnabled(ballInHandMine && isMyTurn);
    scene.setAimEnabled(isMyTurn);

    scene.onShotStarted = () => {
      shootingRef.current = true;
      setShooting(true);
      setFoulNotice("");
      setError("");
      play("cue-strike");
    };

    // Every ball that drops mid-simulation gets its own satisfying
    // "clack" - the cue ball scratching is still a pocket physically,
    // but it's a foul first and foremost, so that one's covered by
    // the "foul" sound below instead of doubling up here.
    scene.onBallPocketed = (id) => {
      if (id === 0) return;
      play("ball-pocket");
    };

    scene.onSettled = async (result) => {
      try {
        const res = await fetch("/api/pool/shot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match_id: matchId, ...result }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.message ?? "Shot could not be recorded");
          // Fall back to reloading the authoritative state so the board
          // doesn't stay stuck showing an un-submitted local result.
          await loadState();
        } else {
          setState(json.state as PoolState);
          if (json.foul && json.foul_reason) {
            setFoulNotice(json.foul_reason as string);
            setTimeout(() => setFoulNotice(""), 4500);
            play("foul");
          }
        }
      } catch {
        setError("Network error — please try again.");
        await loadState();
      } finally {
        shootingRef.current = false;
        setShooting(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, userId, matchId]);

  if (!state) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--lj-muted)]">
        Loading table…
      </div>
    );
  }

  const mySeat = state.a_player_id === userId ? "A" : state.b_player_id === userId ? "B" : null;
  const isMyTurn = mySeat !== null && state.current_turn === mySeat && !state.game_over;
  const ballInHandMine = mySeat !== null && state.ball_in_hand === mySeat;
  const myType = mySeat ? state.player_type[mySeat] : null;

  const typeLabel =
    state.phase === "break"
      ? "Break shot"
      : myType
        ? `You're ${myType === "solid" ? "Solids (1-7)" : "Stripes (9-15)"}`
        : "Table is open";

  return (
    <div className="flex flex-col items-center gap-3">
      {!state.game_over && (
        <div
          className={`w-full rounded-xl px-4 py-2 text-center text-sm font-semibold ${isMyTurn ? "bg-blue-500/10 text-blue-300" : "bg-white/5 text-[var(--lj-muted)]"}`}
        >
          {isMyTurn
            ? shooting
              ? "Taking your shot…"
              : ballInHandMine
                ? "Ball in hand — drag the cue ball, then drag from it to aim"
                : "Your turn — drag from the cue ball to aim, release to shoot"
            : "Waiting for opponent…"}
        </div>
      )}

      <div className="flex w-full items-center justify-between px-1 text-xs font-semibold text-[var(--lj-muted)]">
        <span>{typeLabel}</span>
        {state.game_over && (
          <span className="text-green-300">
            {state.winner === mySeat ? "🏆 You won!" : "Game over"}
          </span>
        )}
      </div>

      {foulNotice && (
        <div className="w-full rounded-xl bg-red-500/10 px-4 py-2 text-center text-xs font-semibold text-red-300">
          Foul: {foulNotice}
        </div>
      )}

      <div
        className="relative mx-auto w-full overflow-hidden rounded-xl"
        style={{ maxWidth: 700, aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
