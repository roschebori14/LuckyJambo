"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Dices } from "lucide-react";
import {
  LADDERS,
  SNAKES,
  BOARD_SIZE,
  GRID_DIM,
  squareToRowCol,
  type SnakesLaddersState,
} from "@/types/snakes-ladders";
import { useMatchRealtime } from "@/hooks/use-match-realtime";

interface Props {
  matchId: string;
  userId: string;
}

// Small standard 1-6 pip layout, reused for both the static "last roll"
// readout and the rolling animation.
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div
      className={`grid h-12 w-12 grid-cols-3 grid-rows-3 gap-[3px] rounded-xl bg-white p-2 shadow-md ${
        rolling ? "animate-spin" : ""
      }`}
      style={rolling ? { animationDuration: "0.5s" } : undefined}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const isPip = PIPS[value]?.some(([pr, pc]) => pr === r && pc === c);
        return (
          <div key={i} className="flex items-center justify-center">
            {isPip && <div className="h-2 w-2 rounded-full bg-slate-900" />}
          </div>
        );
      })}
    </div>
  );
}

export default function SnakesLaddersBoard({ matchId, userId }: Props) {
  const [state, setState] = useState<SnakesLaddersState | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState("");
  const [displayRoll, setDisplayRoll] = useState(1);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/snakes-ladders/state?match_id=${matchId}`);
    const json = await res.json();
    if (json.success) setState(json.state as SnakesLaddersState);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Live update: opponent's roll lands instantly instead of waiting up
  // to 3s for the next poll.
  useMatchRealtime(matchId, (row) => {
    if (row.game_state) setState(row.game_state as SnakesLaddersState);
  });

  async function rollDice() {
    if (!state || state.game_over || rolling) return;
    setRolling(true);
    setError("");

    // Purely cosmetic shuffle while we wait for the server's real roll.
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
        setState(json.state as SnakesLaddersState);
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

  const isMyTurn = !!state && !state.game_over && state.current_turn === userId;
  const myPos = state?.positions?.[userId] ?? 0;
  const oppPos = opponentId ? state?.positions?.[opponentId] ?? 0 : 0;
  const iWon = state?.game_over && state.winner_id === userId;
  const isDraw = state?.game_over && !state.winner_id;

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
    : isMyTurn
    ? "Your turn — roll the die"
    : "Waiting for opponent to roll…";

  const lastRoll = state.last_roll;
  const lastRollWasMine = lastRoll?.player_id === userId;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Status */}
      <div
        className={`w-full rounded-xl px-4 py-3 text-center text-sm font-semibold ${
          state.game_over
            ? iWon
              ? "bg-green-500/10 text-green-300"
              : isDraw
              ? "bg-yellow-500/10 text-yellow-300"
              : "bg-red-500/10 text-red-300"
            : isMyTurn
            ? "bg-blue-500/10 text-blue-300"
            : "bg-white/5 text-[var(--lj-muted)]"
        }`}
      >
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
      <div className="grid w-full max-w-[420px] grid-cols-10 gap-[2px] rounded-lg border border-[var(--lj-border)] overflow-hidden">
        {Array.from({ length: BOARD_SIZE }, (_, i) => i + 1).map((square) => {
          const { row, col } = squareToRowCol(square);
          const isLadder = square in LADDERS;
          const isSnake = square in SNAKES;
          const hasMe = myPos === square;
          const hasOpp = oppPos === square;
          const shade = (row + col) % 2 === 0 ? "bg-white/[0.04]" : "bg-white/[0.02]";

          return (
            <div
              key={square}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
              className={`relative flex aspect-square flex-col items-center justify-center text-[9px] font-medium ${shade} ${
                isLadder ? "outline outline-1 outline-green-500/40" : ""
              } ${isSnake ? "outline outline-1 outline-red-500/40" : ""}`}
            >
              <span className="absolute left-0.5 top-0.5 text-[8px] text-white/30">{square}</span>
              {isLadder && (
                <span className="text-[9px] font-bold text-green-400">▲{LADDERS[square]}</span>
              )}
              {isSnake && (
                <span className="text-[9px] font-bold text-red-400">▼{SNAKES[square]}</span>
              )}
              <div className="mt-1 flex gap-0.5">
                {hasMe && <span className="h-2.5 w-2.5 rounded-full bg-blue-400 shadow" />}
                {hasOpp && <span className="h-2.5 w-2.5 rounded-full bg-red-400 shadow" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex w-full items-center justify-center gap-4 text-[10px] text-[var(--lj-muted)]">
        <span className="flex items-center gap-1"><span className="text-green-400">▲</span> Ladder up</span>
        <span className="flex items-center gap-1"><span className="text-red-400">▼</span> Snake down</span>
      </div>

      {/* Roll control */}
      {!state.game_over && (
        <div className="flex flex-col items-center gap-3">
          <Die value={displayRoll} rolling={rolling} />
          <button
            onClick={rollDice}
            disabled={!isMyTurn || rolling}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Dices size={16} />
            {rolling ? "Rolling…" : isMyTurn ? "Roll the Die" : "Waiting for opponent…"}
          </button>
        </div>
      )}
    </div>
  );
}
