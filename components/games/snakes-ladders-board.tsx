"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dices, Trophy, Frown, Handshake, Clock } from "lucide-react";
import {
  LADDERS,
  SNAKES,
  BOARD_SIZE,
  squareToRowCol,
  type SnakesLaddersState,
  type LastRoll,
} from "@/types/snakes-ladders";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";

interface Props {
  matchId: string;
  userId: string;
}

// ---------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function Die({ value, rolling, glow }: { value: number; rolling: boolean; glow: boolean }) {
  return (
    <div
      className={`grid h-14 w-14 grid-cols-3 grid-rows-3 gap-[3px] rounded-xl bg-white p-2 shadow-lg transition-shadow ${
        rolling ? "animate-spin" : ""
      } ${glow ? "shadow-[0_0_0_4px_rgba(74,222,128,0.35)]" : ""}`}
      style={rolling ? { animationDuration: "0.5s" } : undefined}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const isPip = PIPS[value]?.some(([pr, pc]) => pr === r && pc === c);
        return (
          <div key={i} className="flex items-center justify-center">
            {isPip && <div className="h-2.5 w-2.5 rounded-full bg-slate-900" />}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// Geometry helpers - everything below works in a 0-100 coordinate
// space that lines up 1:1 with the board's percentage-based layout,
// so the SVG overlay, the ladder/snake art, and the token positions
// all share the same units.
// ---------------------------------------------------------------------

function squareCenter(square: number) {
  const { row, col } = squareToRowCol(square);
  return { x: col * 10 + 5, y: row * 10 + 5 };
}

function ladderGeometry(bottom: number, top: number) {
  const p0 = squareCenter(bottom);
  const p1 = squareCenter(top);
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const rail = 1.5;
  const rungCount = Math.max(3, Math.round(len / 7));
  const rungs = Array.from({ length: rungCount }, (_, i) => {
    const t = (i + 1) / (rungCount + 1);
    const cx = p0.x + dx * t;
    const cy = p0.y + dy * t;
    return { x1: cx + px * rail, y1: cy + py * rail, x2: cx - px * rail, y2: cy - py * rail };
  });
  return {
    rail1: { x1: p0.x + px * rail, y1: p0.y + py * rail, x2: p1.x + px * rail, y2: p1.y + py * rail },
    rail2: { x1: p0.x - px * rail, y1: p0.y - py * rail, x2: p1.x - px * rail, y2: p1.y - py * rail },
    rungs,
  };
}

function snakePath(head: number, tail: number) {
  const p0 = squareCenter(head);
  const p1 = squareCenter(tail);
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const offset = Math.min(7, len * 0.25);
  const c1 = { x: p0.x + dx * 0.33 + px * offset, y: p0.y + dy * 0.33 + py * offset };
  const c2 = { x: p0.x + dx * 0.66 - px * offset, y: p0.y + dy * 0.66 - py * offset };
  return { d: `M ${p0.x} ${p0.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p1.x} ${p1.y}`, head: p0 };
}

// ---------------------------------------------------------------------
// Board component
// ---------------------------------------------------------------------

export default function SnakesLaddersBoard({ matchId, userId }: Props) {
  const { play } = useSound();
  const [state, setState] = useState<SnakesLaddersState | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState("");
  const [displayRoll, setDisplayRoll] = useState(1);

  // Positions actually rendered on the board - decoupled from
  // state.positions so a landed roll can be animated step-by-step
  // instead of the token teleporting straight to its new square.
  const [renderPos, setRenderPos] = useState<Record<string, number>>({});
  const [warp, setWarp] = useState<{ player: string; kind: "ladder" | "snake" } | null>(null);
  const [log, setLog] = useState<(LastRoll & { key: string })[]>([]);
  const [showResult, setShowResult] = useState(false);

  const lastAnimatedKey = useRef<string | null>(null);
  const prevGameOver = useRef(false);
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stateRef = useRef<SnakesLaddersState | null>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/snakes-ladders/state?match_id=${matchId}`);
    const json = await res.json();
    if (json.success) applyState(json.state as SnakesLaddersState);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  useMatchRealtime(matchId, (row) => {
    if (row.game_state) applyState(row.game_state as SnakesLaddersState);
  });

  useEffect(() => {
    return () => {
      animTimers.current.forEach(clearTimeout);
    };
  }, []);

  function queue(fn: () => void, delay: number) {
    const t = setTimeout(fn, delay);
    animTimers.current.push(t);
  }

  // Central place every new snapshot of server state flows through -
  // detects a fresh roll and animates the mover's token across the
  // squares it actually passed through, then (if it landed on a
  // ladder/snake) glides it the rest of the way to its final square.
  function applyState(next: SnakesLaddersState) {
    const prev = stateRef.current;
    const lr = next.last_roll;
    const key = lr ? `${next.rolls_used}-${lr.player_id}-${lr.from}-${lr.to}` : null;

    if (!prev) {
      // First time we ever see this match's state: snap tokens in
      // place with no animation.
      setRenderPos(next.positions ?? {});
      lastAnimatedKey.current = key;
    } else if (lr && key && key !== lastAnimatedKey.current) {
      lastAnimatedKey.current = key;
      setLog((l) => [{ ...lr, key }, ...l].slice(0, 8));
      animateMove(lr);
    } else if (!lr) {
      setRenderPos(next.positions ?? {});
    }

    stateRef.current = next;
    setState(next);
  }

  function animateMove(lr: LastRoll) {
    const raw = lr.from + lr.roll;
    const bounced = raw > 100; // overshoot - the roll was wasted, token never moves
    const steps: number[] = [];
    if (!bounced) {
      for (let s = lr.from + 1; s <= Math.min(raw, 100); s++) steps.push(s);
    }

    let delay = 0;
    const STEP_MS = 180;

    steps.forEach((sq) => {
      queue(() => {
        setRenderPos((p) => ({ ...p, [lr.player_id]: sq }));
      }, delay);
      delay += STEP_MS;
    });

    if (!bounced && lr.to !== raw) {
      const kind = lr.used_ladder ? "ladder" : "snake";
      queue(() => setWarp({ player: lr.player_id, kind }), delay + 120);
      queue(() => {
        setRenderPos((p) => ({ ...p, [lr.player_id]: lr.to }));
      }, delay + 220);
      delay += 220 + 650;
      queue(() => setWarp(null), delay);
    } else if (bounced) {
      // Nothing moves, but flash isn't necessary - the status banner
      // already explains it via the roll log.
      delay += 200;
    }
  }

  async function rollDice() {
    if (!state || state.game_over || rolling || !state.player_2_id) return;
    play("dice-roll");
    setRolling(true);
    setError("");

    const shuffle = setInterval(() => setDisplayRoll(1 + Math.floor(Math.random() * 6)), 90);

    try {
      const res = await fetch("/api/snakes-ladders/roll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });
      const json = await res.json();
      clearInterval(shuffle);
      if (json.success) {
        setDisplayRoll(json.roll);
        applyState(json.state as SnakesLaddersState);
      } else {
        setError(json.message ?? "Roll failed");
      }
    } catch {
      clearInterval(shuffle);
      setError("Network error — please try again.");
    } finally {
      setRolling(false);
    }
  }

  const opponentId = useMemo(() => {
    if (!state) return null;
    return state.player_1_id === userId ? state.player_2_id : state.player_1_id;
  }, [state, userId]);

  const waitingForOpponent = !!state && !state.player_2_id;
  const isMyTurn = !!state && !state.game_over && !waitingForOpponent && state.current_turn === userId;
  const myPos = renderPos[userId] ?? state?.positions?.[userId] ?? 0;
  const oppPos = opponentId ? renderPos[opponentId] ?? state?.positions?.[opponentId] ?? 0 : 0;
  const iWon = state?.game_over && state.winner_id === userId;
  const isDraw = state?.game_over && !state.winner_id;

  // Pop the result overlay once, right when the match actually ends.
  useEffect(() => {
    if (state?.game_over && !prevGameOver.current) {
      queue(() => setShowResult(true), 500);
    }
    prevGameOver.current = !!state?.game_over;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.game_over]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (!state) return <p className="text-center text-[var(--lj-muted)]">Failed to load game state.</p>;

  const statusText = state.game_over
    ? iWon
      ? "🏆 You won!"
      : isDraw
      ? "It's a draw — round limit reached. Stakes refunded."
      : "😔 You lost."
    : waitingForOpponent
    ? "Waiting for an opponent to join…"
    : isMyTurn
    ? "Your turn — roll the die"
    : "Waiting for opponent to roll…";

  const lastRoll = state.last_roll;
  const lastRollWasMine = lastRoll?.player_id === userId;
  const ladderEntries = Object.entries(LADDERS).map(([b, t]) => [Number(b), t] as const);
  const snakeEntries = Object.entries(SNAKES).map(([h, t]) => [Number(h), t] as const);

  return (
    <div className="flex flex-col items-center gap-4">
      <style>{`
        @keyframes sl-confetti-fall {
          0% { transform: translateY(-10%) rotate(0deg); opacity: 1; }
          100% { transform: translateY(420%) rotate(340deg); opacity: 0; }
        }
        @keyframes sl-token-warp {
          0% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.6); filter: brightness(1.6); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes sl-pop-in {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Status */}
      <div
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-sm font-semibold ${
          state.game_over
            ? iWon
              ? "bg-green-500/10 text-green-300"
              : isDraw
              ? "bg-yellow-500/10 text-yellow-300"
              : "bg-red-500/10 text-red-300"
            : waitingForOpponent
            ? "bg-white/5 text-[var(--lj-muted)]"
            : isMyTurn
            ? "bg-blue-500/10 text-blue-300"
            : "bg-white/5 text-[var(--lj-muted)]"
        }`}
      >
        {waitingForOpponent && <Clock size={14} className="animate-pulse" />}
        {statusText}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Positions + last roll readout */}
      <div className="flex w-full items-center justify-between px-1 text-xs text-[var(--lj-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-400" /> You: square {myPos}
        </span>
        {lastRoll && (
          <span className="italic">
            {lastRollWasMine ? "You" : "Opponent"} rolled {lastRoll.roll}: {lastRoll.from} → {lastRoll.to}
            {lastRoll.used_ladder ? " 🪜" : lastRoll.used_snake ? " 🐍" : ""}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          Opponent: square {oppPos} <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        </span>
      </div>

      {/* Board */}
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-lg border border-[var(--lj-border)]">
        {/* Cells */}
        <div className="grid grid-cols-10 gap-[2px] bg-[var(--lj-border)]">
          {Array.from({ length: BOARD_SIZE }, (_, i) => i + 1).map((square) => {
            const { row, col } = squareToRowCol(square);
            const isLadderStart = square in LADDERS;
            const isSnakeStart = square in SNAKES;
            const shade = (row + col) % 2 === 0 ? "bg-white/[0.04]" : "bg-white/[0.02]";

            return (
              <div
                key={square}
                style={{ gridRow: row + 1, gridColumn: col + 1 }}
                className={`relative flex aspect-square flex-col items-center justify-start pt-0.5 text-[9px] font-medium ${shade}`}
              >
                <span
                  className={`text-[8px] ${
                    isLadderStart ? "text-green-400/70 font-bold" : isSnakeStart ? "text-red-400/70 font-bold" : "text-white/25"
                  }`}
                >
                  {square}
                </span>
              </div>
            );
          })}
        </div>

        {/* Ladder / snake art, drawn in the same 0-100 coordinate
            space as the grid so it lines up exactly regardless of
            container size. */}
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
        >
          {ladderEntries.map(([bottom, top]) => {
            const g = ladderGeometry(bottom, top);
            return (
              <g key={`ladder-${bottom}`}>
                <line {...g.rail1} stroke="#eab308" strokeWidth={0.9} strokeLinecap="round" opacity={0.9} />
                <line {...g.rail2} stroke="#eab308" strokeWidth={0.9} strokeLinecap="round" opacity={0.9} />
                {g.rungs.map((r, i) => (
                  <line key={i} {...r} stroke="#facc15" strokeWidth={0.7} strokeLinecap="round" opacity={0.85} />
                ))}
              </g>
            );
          })}

          {snakeEntries.map(([head, tail]) => {
            const s = snakePath(head, tail);
            return (
              <g key={`snake-${head}`}>
                <path d={s.d} stroke="#f43f5e" strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.85} />
                <circle cx={s.head.x} cy={s.head.y} r={1.9} fill="#f43f5e" />
                <circle cx={s.head.x - 0.6} cy={s.head.y - 0.5} r={0.35} fill="white" />
                <circle cx={s.head.x + 0.6} cy={s.head.y - 0.5} r={0.35} fill="white" />
              </g>
            );
          })}
        </svg>

        {/* Tokens - absolutely positioned + CSS-transitioned so they
            glide between squares instead of teleporting. */}
        {[
          { id: userId, pos: myPos, color: "bg-blue-400", ring: "ring-blue-200" },
          ...(opponentId ? [{ id: opponentId, pos: oppPos, color: "bg-red-400", ring: "ring-red-200" }] : []),
        ].map((t) => {
          const { x, y } = squareCenter(t.pos);
          const isWarping = warp?.player === t.id;
          return (
            <div
              key={t.id}
              className={`absolute h-[7%] w-[7%] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md ring-2 ${t.color} ${t.ring}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transition: "left 170ms ease-in-out, top 170ms ease-in-out",
                animation: isWarping ? "sl-token-warp 550ms ease-in-out" : undefined,
                zIndex: 10,
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex w-full items-center justify-center gap-4 text-[10px] text-[var(--lj-muted)]">
        <span className="flex items-center gap-1"><span className="text-yellow-400">▲</span> Ladder up</span>
        <span className="flex items-center gap-1"><span className="text-red-400">▼</span> Snake down</span>
      </div>

      {/* Roll log */}
      {log.length > 0 && (
        <div className="w-full rounded-xl border border-[var(--lj-border)] bg-white/[0.03] p-2">
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--lj-muted)]">
            Recent rolls
          </p>
          <ul className="max-h-24 space-y-1 overflow-y-auto text-[11px] text-[var(--lj-muted)]">
            {log.map((entry) => (
              <li key={entry.key} className="flex items-center justify-between px-1">
                <span>{entry.player_id === userId ? "You" : "Opponent"} rolled {entry.roll}</span>
                <span>
                  {entry.from} → {entry.to}
                  {entry.used_ladder ? " 🪜" : entry.used_snake ? " 🐍" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Roll control */}
      {!state.game_over && (
        <div className="flex flex-col items-center gap-3">
          <Die value={displayRoll} rolling={rolling} glow={isMyTurn && !rolling} />
          <button
            onClick={rollDice}
            disabled={!isMyTurn || rolling}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white transition-transform hover:bg-green-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            <Dices size={16} className={rolling ? "animate-spin" : ""} />
            {rolling ? "Rolling…" : waitingForOpponent ? "Waiting for opponent…" : isMyTurn ? "Roll the Die" : "Waiting for opponent…"}
          </button>
        </div>
      )}

      {/* Result overlay */}
      {showResult && state.game_over && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowResult(false)}
        >
          {iWon &&
            Array.from({ length: 24 }, (_, i) => (
              <span
                key={i}
                className="absolute top-0 h-2 w-2 rounded-sm"
                style={{
                  left: `${(i * 37) % 100}%`,
                  backgroundColor: ["#facc15", "#4ade80", "#60a5fa", "#f472b6"][i % 4],
                  animation: `sl-confetti-fall ${1.4 + (i % 5) * 0.2}s linear ${(i % 6) * 0.12}s forwards`,
                }}
              />
            ))}

          <div
            className="relative flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl bg-[var(--lj-card-2)] p-6 text-center shadow-2xl"
            style={{ animation: "sl-pop-in 200ms ease-out" }}
            onClick={(e) => e.stopPropagation()}
          >
            {iWon ? (
              <Trophy size={40} className="text-yellow-400" />
            ) : isDraw ? (
              <Handshake size={40} className="text-yellow-300" />
            ) : (
              <Frown size={40} className="text-red-400" />
            )}
            <h3 className="text-xl font-extrabold text-white">
              {iWon ? "You won!" : isDraw ? "It's a draw" : "You lost"}
            </h3>
            <p className="text-sm text-[var(--lj-muted)]">
              {iWon
                ? "Nice climb — the payout has been added to your wallet."
                : isDraw
                ? "Round limit reached with nobody home — both stakes were refunded."
                : "Better luck on the next roll."}
            </p>
            <button
              onClick={() => setShowResult(false)}
              className="mt-1 rounded-xl bg-white/10 px-5 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
