"use client";

import { useEffect, useRef, useState } from "react";
import type { LudoState, LudoColor } from "@/types/ludo";
import { useSound } from "@/lib/sound/sound-manager";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { createClient } from "@/lib/supabase/client";

const COLOR_HEX: Record<LudoColor, number> = {
  red: 0xef4444,
  green: 0x22c55e,
  yellow: 0xeab308,
  blue: 0x3b82f6,
};
// Colorblind-friendly secondary marker per color - a letter drawn on
// each token in addition to its color, so seats are distinguishable
// without relying on color perception alone.
const COLOR_LETTER: Record<LudoColor, string> = { red: "R", green: "G", yellow: "Y", blue: "B" };

const CELL = 30;
const SIZE = 15 * CELL;

const BASE_ARM: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8],
];

function rotate90([r, c]: [number, number]): [number, number] {
  return [c, 14 - r];
}

function buildPath(): [number, number][] {
  let arm = BASE_ARM;
  const path: [number, number][] = [];
  for (let side = 0; side < 4; side++) {
    path.push(...arm);
    arm = arm.map(rotate90) as [number, number][];
  }
  const last = path.pop()!;
  path.unshift(last);
  return path;
}

const OUTER_PATH = buildPath();

const BASE_HOME_COLUMN: [number, number][] = [
  [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6],
];

function buildHomeColumns(): Record<LudoColor, [number, number][]> {
  const colors: LudoColor[] = ["red", "green", "yellow", "blue"];
  let col = BASE_HOME_COLUMN;
  const result = {} as Record<LudoColor, [number, number][]>;
  colors.forEach((color) => {
    result[color] = col;
    col = col.map(rotate90) as [number, number][];
  });
  return result;
}

const HOME_COLUMNS = buildHomeColumns();

const YARD_ORIGIN: Record<LudoColor, [number, number]> = {
  red: [1, 1],
  green: [1, 9],
  yellow: [9, 9],
  blue: [9, 1],
};

const ENTRY_OFFSET: Record<LudoColor, number> = { red: 1, green: 14, yellow: 27, blue: 40 };

function tokenPixel(color: LudoColor, relative: number, slot: number): { x: number; y: number } {
  let row: number, col: number;
  if (relative === -1) {
    const [yr, yc] = YARD_ORIGIN[color];
    row = yr + Math.floor(slot / 2) * 2;
    col = yc + (slot % 2) * 2;
  } else if (relative <= 50) {
    const abs = (ENTRY_OFFSET[color] + relative) % 52;
    [row, col] = OUTER_PATH[abs];
  } else if (relative <= 56) {
    [row, col] = HOME_COLUMNS[color][relative - 51];
  } else {
    row = 7; col = 7;
  }
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

interface LudoBoardProps {
  matchId: string;
  userId: string;
}

export default function LudoBoard({ matchId, userId }: LudoBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const sceneRef = useRef<import("phaser").Scene | null>(null);
  const { play } = useSound();
  const [state, setState] = useState<LudoState | null>(null);
  const [error, setError] = useState("");
  const [rolling, setRolling] = useState(false);
  const [rollDisplay, setRollDisplay] = useState<number | null>(null);
  const [passedNotice, setPassedNotice] = useState("");
  const [usernames, setUsernames] = useState<Map<string, string>>(new Map());
  const [forfeiting, setForfeiting] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const prevStateRef = useRef<LudoState | null>(null);

  async function loadState() {
    try {
      const res = await fetch(`/api/ludo/state?match_id=${matchId}`);
      const json = await res.json();
      if (json.success) applyNewState(json.match.game_state as LudoState);
    } catch {
      /* next poll/realtime event will retry */
    }
  }

  // Detects an opponent capture by diffing token positions (a
  // non-mover's token snapping from a live outer-loop position back to
  // -1 is a capture, not a coincidence - move_ludo_token is the only
  // thing that ever changes tokens, and it only ever sends *other*
  // seats' tokens home, never resets its own mover's token to -1)
  // purely so we can play a distinct sound/flash - the actual capture
  // logic is 100% server-side (057_ludo.sql), this is presentation only.
  function applyNewState(next: LudoState) {
    const prev = prevStateRef.current;
    if (prev) {
      let captured = false;
      next.tokens.forEach((seatTokens, seatIdx) => {
        seatTokens.forEach((pos, tokenIdx) => {
          const prevPos = prev.tokens?.[seatIdx]?.[tokenIdx];
          if (prevPos != null && prevPos >= 0 && prevPos <= 50 && pos === -1) {
            captured = true;
          }
        });
      });
      if (captured) {
        play("token-capture");
        setCaptureFlash(true);
        setTimeout(() => setCaptureFlash(false), 350);
      }
    }
    prevStateRef.current = next;
    setState(next);
  }

  useEffect(() => {
    loadState();
    // Realtime keeps this instant; the slow poll is only a fallback in
    // case a realtime event is ever missed (dropped websocket, tab was
    // backgrounded), matching the pattern already used elsewhere in
    // game-client.tsx for match status.
    const interval = setInterval(loadState, 12000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useMatchRealtime(matchId, (row) => {
    if (row.game_state) applyNewState(row.game_state as LudoState);
  });

  // Resolve seat usernames once per newly-seen user id, for the "X's
  // turn" banner - LudoState only carries user_id/color, not names.
  useEffect(() => {
    if (!state) return;
    const ids = state.seats.filter(Boolean).map((s) => s!.user_id).filter((id) => !usernames.has(id));
    if (ids.length === 0) return;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.rpc("get_public_profiles_by_ids", { p_ids: ids });
        setUsernames((prev) => {
          const next = new Map(prev);
          (data ?? []).forEach((p: { id: string; username: string }) => next.set(p.id, p.username));
          return next;
        });
      } catch {
        /* banner just falls back to "Player" below */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.seats]);

  useEffect(() => {
    let destroyed = false;

    import("phaser").then((Phaser) => {
      if (destroyed || !containerRef.current || gameRef.current) return;

      class BoardScene extends Phaser.Scene {
        constructor() { super("board"); }
        tokenPositions = new Map<string, { x: number; y: number }>();

        create() {
          sceneRef.current = this;
          this.drawBoard();
        }

        drawBoard() {
          const g = this.add.graphics();
          g.fillStyle(0x0f1f3d, 1);
          g.fillRect(0, 0, SIZE, SIZE);

          (Object.keys(YARD_ORIGIN) as LudoColor[]).forEach((color) => {
            const [r, c] = YARD_ORIGIN[color];
            g.fillStyle(COLOR_HEX[color], 0.25);
            g.fillRoundedRect(c * CELL - CELL, r * CELL - CELL, CELL * 6, CELL * 6, 8);
          });

          g.lineStyle(1, 0x2d7fff, 0.3);
          OUTER_PATH.forEach(([r, c]) => {
            g.fillStyle(0x16294f, 1);
            g.fillRect(c * CELL, r * CELL, CELL, CELL);
            g.strokeRect(c * CELL, r * CELL, CELL, CELL);
          });

          (Object.keys(HOME_COLUMNS) as LudoColor[]).forEach((color) => {
            HOME_COLUMNS[color].forEach(([r, c]) => {
              g.fillStyle(COLOR_HEX[color], 0.35);
              g.fillRect(c * CELL, r * CELL, CELL, CELL);
            });
          });

          g.fillStyle(0xffffff, 0.08);
          g.fillRect(6 * CELL, 6 * CELL, CELL * 3, CELL * 3);
        }

        renderTokens(s: LudoState, movable: number[], mySeat: number) {
          this.children.list
            .filter((c) => c.getData?.("isToken"))
            .forEach((c) => c.destroy());

          s.seats.forEach((seat, seatIdx) => {
            if (!seat) return;
            s.tokens[seatIdx].forEach((pos, tokenIdx) => {
              const key = `${seatIdx}-${tokenIdx}`;
              const target = tokenPixel(seat.color, pos, tokenIdx);
              const from = this.tokenPositions.get(key) ?? target;
              const isMine = seatIdx === mySeat;
              const canMove = isMine && movable.includes(tokenIdx);

              const circle = this.add.circle(from.x, from.y, CELL * 0.32, COLOR_HEX[seat.color]);
              circle.setStrokeStyle(2, 0xffffff, canMove ? 1 : 0.4);
              circle.setData("isToken", true);

              const label = this.add.text(from.x, from.y, COLOR_LETTER[seat.color], {
                fontSize: "11px", fontStyle: "bold", color: "#0a0e1f",
              }).setOrigin(0.5).setData("isToken", true);

              // Slide from the last known position instead of an
              // instant snap, when this token actually moved.
              if (from.x !== target.x || from.y !== target.y) {
                this.tweens.add({ targets: [circle, label], x: target.x, y: target.y, duration: 300, ease: "Cubic.Out" });
              }
              this.tokenPositions.set(key, target);

              if (canMove) {
                circle.setInteractive({ useHandCursor: true });
                circle.on("pointerdown", () => this.onTokenTap?.(tokenIdx));
                this.tweens.add({ targets: circle, scale: 1.15, yoyo: true, repeat: -1, duration: 500 });
              }
            });
          });
        }

        onTokenTap?: (tokenIndex: number) => void;
      }

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: SIZE,
        height: SIZE,
        parent: containerRef.current,
        backgroundColor: "#0f1f3d",
        scene: BoardScene,
        // FIT scales the canvas down to whatever the parent's width
        // actually is (see the aspect-square wrapper div below) while
        // keeping every pixel-math constant (CELL, SIZE, tokenPixel)
        // untouched - the board is still "drawn" at a fixed 450x450
        // internally, Phaser just displays it smaller on narrow
        // screens instead of overflowing a ~360-390px phone viewport.
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: SIZE,
          height: SIZE,
        },
      });

      gameRef.current = game;
    });

    return () => {
      destroyed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!state || !sceneRef.current) return;
    const mySeat = state.seats.findIndex((s) => s?.user_id === userId);
    (sceneRef.current as unknown as { renderTokens: (s: LudoState, m: number[], seat: number) => void; onTokenTap?: (i: number) => void }).renderTokens(state, state.movable_tokens, mySeat);
    (sceneRef.current as unknown as { onTokenTap?: (i: number) => void }).onTokenTap = async (tokenIndex: number) => {
      try {
        const res = await fetch("/api/ludo/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match_id: matchId, token_index: tokenIndex }),
        });
        const json = await res.json();
        if (json.success) {
          play("move");
          applyNewState(json.state as LudoState);
        } else {
          setError(json.message ?? "Move failed");
        }
      } catch {
        setError("Network error — please try again.");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, userId, matchId, play]);

  if (!state) {
    return <div className="flex h-64 items-center justify-center text-sm text-[var(--lj-muted)]">Loading board…</div>;
  }

  const mySeat = state.seats.findIndex((s) => s?.user_id === userId);
  const isMyTurn = state.current_seat === mySeat;
  const canRoll = isMyTurn && !state.awaiting_move && !state.game_over;
  const currentSeatObj = state.seats[state.current_seat];
  const currentName = currentSeatObj ? usernames.get(currentSeatObj.user_id) ?? "Player" : "…";

  async function roll() {
    setRolling(true);
    setError("");
    setPassedNotice("");
    // Lightweight "tumbling" number cycle while we wait on the
    // server-generated roll (Postgres owns the actual randomness -
    // see roll_ludo_dice - this is purely a ~500ms visual flourish,
    // not a real physics tumble).
    const cycle = setInterval(() => setRollDisplay(1 + Math.floor(Math.random() * 6)), 80);
    try {
      const res = await fetch("/api/ludo/roll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });
      const json = await res.json();
      await new Promise((r) => setTimeout(r, 500)); // let the cycle animation play out
      clearInterval(cycle);
      if (!json.success) {
        setError(json.message ?? "Roll failed");
        return;
      }
      setRollDisplay(json.roll);
      play("dice-roll");
      if (json.passed) {
        setPassedNotice("No legal moves — turn passed.");
        setTimeout(() => setPassedNotice(""), 3500);
      }
      const res2 = await fetch(`/api/ludo/state?match_id=${matchId}`);
      const json2 = await res2.json();
      if (json2.success) applyNewState(json2.match.game_state as LudoState);
    } catch {
      clearInterval(cycle);
      setError("Network error — please try again.");
    } finally {
      setRolling(false);
    }
  }

  async function forfeit() {
    if (!window.confirm("Are you sure? You'll forfeit your stake and leave the match.")) return;
    setForfeiting(true);
    try {
      const res = await fetch("/api/ludo/forfeit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });
      const json = await res.json();
      if (!json.success) setError(json.message ?? "Could not forfeit");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setForfeiting(false);
    }
  }

  const mySeatObj = mySeat >= 0 ? state.seats[mySeat] : null;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Clear current-turn banner */}
      {!state.game_over && (
        <div className={`w-full rounded-xl px-4 py-2 text-center text-sm font-semibold ${isMyTurn ? "bg-blue-500/10 text-blue-300" : "bg-white/5 text-[var(--lj-muted)]"}`}>
          {isMyTurn ? "Your turn" : `${currentName}'s turn`}
        </div>
      )}
      {passedNotice && (
        <div className="w-full rounded-xl bg-yellow-500/10 px-4 py-2 text-center text-xs font-semibold text-yellow-300">
          {passedNotice}
        </div>
      )}

      <div className="flex w-full items-center justify-between px-1 text-sm">
        <div className="flex items-center gap-2">
          {state.seats.map((seat, i) =>
            seat ? (
              <span
                key={i}
                className={`h-3 w-3 rounded-full ${state.current_seat === i ? "ring-2 ring-white" : ""}`}
                style={{ background: `#${COLOR_HEX[seat.color].toString(16)}` }}
                title={usernames.get(seat.user_id) ?? "Player"}
              />
            ) : null
          )}
        </div>
        {mySeatObj && (
          <span className="text-xs font-semibold text-[var(--lj-muted)]">
            You're <span style={{ color: `#${COLOR_HEX[mySeatObj.color].toString(16)}` }}>{mySeatObj.color}</span>
          </span>
        )}
      </div>

      {/* Responsive square wrapper - Phaser's Scale.FIT mode scales the
          fixed-resolution canvas down to fit this container's actual
          width instead of overflowing on phone-sized viewports. */}
      <div className="relative mx-auto w-full max-w-[450px] aspect-square overflow-hidden rounded-xl">
        <div ref={containerRef} className="h-full w-full" />
        {captureFlash && (
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-red-500/25" />
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        {(rollDisplay != null || state.dice_value != null) && (
          <span className={`flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg font-black text-black ${rolling ? "animate-bounce" : ""}`}>
            {rollDisplay ?? state.dice_value}
          </span>
        )}
        <button
          onClick={roll}
          disabled={!canRoll || rolling}
          className="lj-btn-primary disabled:opacity-40"
        >
          {isMyTurn ? (rolling ? "Rolling…" : state.awaiting_move ? "Pick a token above" : "Roll Dice") : "Waiting for turn…"}
        </button>
      </div>

      {!state.game_over && (
        <button
          onClick={forfeit}
          disabled={forfeiting}
          className="mt-1 text-xs font-semibold text-red-400/70 hover:text-red-400 disabled:opacity-40"
        >
          {forfeiting ? "Forfeiting…" : "Forfeit match (stake is lost)"}
        </button>
      )}
    </div>
  );
}
