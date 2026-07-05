"use client";

import { useState, useEffect, useCallback } from "react";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";
import type { FourInARowState } from "@/types/four-in-a-row";

const ROWS = 6;
const COLS = 7;

interface Props {
  matchId: string;
  userId: string;
}

export default function FourInARowBoard({ matchId, userId }: Props) {
  const { play } = useSound();
  const [state, setState] = useState<FourInARowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/four-in-a-row/state?match_id=${matchId}`);
    const json = await res.json();
    if (json.success) setState(json.state);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  useMatchRealtime(matchId, (row) => {
    if (row.game_state) setState(row.game_state as FourInARowState);
  });

  async function dropDisc(column: number) {
    if (!state || state.game_over || moving) return;
    const mySeat = state.r_player_id === userId ? "R" : "Y";
    if (state.current_turn !== mySeat) return;
    if (state.column_heights[column] >= ROWS) return;

    setMoving(true);
    setError("");
    try {
      const res = await fetch("/api/four-in-a-row/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, column }),
      });
      const json = await res.json();
      if (json.success) {
        play("move");
        setState(json.state);
      } else {
        setError(json.message);
      }
    } finally {
      setMoving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!state) return <p className="text-center text-[var(--lj-muted)]">Failed to load game state.</p>;

  const mySeat = state.r_player_id === userId ? "R" : "Y";
  const isMyTurn = state.current_turn === mySeat && !state.game_over;
  const won = state.winner === mySeat;

  const statusText = state.game_over
    ? state.is_draw
      ? "It's a draw! Stakes refunded."
      : won
      ? "🏆 You won!"
      : "😔 You lost."
    : isMyTurn
    ? "Your turn — pick a column"
    : "Waiting for opponent…";

  const discColor = (disc: "R" | "Y" | null) =>
    disc === "R" ? "#ff3d5a" : disc === "Y" ? "#ffd700" : "transparent";

  return (
    <div className="flex flex-col items-center gap-5">
      <div className={`w-full rounded-xl px-4 py-3 text-center text-sm font-semibold ${
        state.game_over
          ? won ? "bg-green-500/10 text-green-300" : state.is_draw ? "bg-yellow-500/10 text-yellow-300" : "bg-red-500/10 text-red-300"
          : isMyTurn ? "bg-blue-500/10 text-blue-300" : "bg-white/5 text-[var(--lj-muted)]"
      }`}>
        {statusText}
        <span className="ml-2 text-xs opacity-70">
          You are {mySeat === "R" ? "🔴 Red" : "🟡 Yellow"}
        </span>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Column hover/drop buttons */}
      <div className="grid w-full max-w-[420px] gap-1.5" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {Array.from({ length: COLS }).map((_, col) => {
          const full = state.column_heights[col] >= ROWS;
          const clickable = isMyTurn && !full && !moving;
          return (
            <button
              key={col}
              onClick={() => dropDisc(col)}
              onMouseEnter={() => setHoverCol(col)}
              onMouseLeave={() => setHoverCol(null)}
              disabled={!clickable}
              className={`flex h-7 items-center justify-center rounded-md text-xs font-bold transition-colors ${
                clickable ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 cursor-pointer" : "bg-white/5 text-[var(--lj-muted)]"
              }`}
              aria-label={`Drop disc in column ${col + 1}`}
            >
              ▼
            </button>
          );
        })}
      </div>

      {/* Board */}
      <div
        className="grid w-full max-w-[420px] gap-1.5 rounded-2xl p-3"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          background: "linear-gradient(135deg, #1a56ff 0%, #2d7fff 100%)",
        }}
      >
        {state.cells.map((disc, i) => {
          const col = i % COLS;
          const isWinningCell = state.winning_line?.includes(i) ?? false;
          const isPreview = hoverCol === col && isMyTurn && state.column_heights[col] < ROWS && !disc;
          return (
            <div
              key={i}
              className="relative flex aspect-square items-center justify-center rounded-full"
              style={{ background: "rgba(4, 9, 26, 0.55)" }}
            >
              <div
                className="h-[82%] w-[82%] rounded-full transition-transform"
                style={{
                  background: isPreview ? "rgba(255,255,255,0.15)" : discColor(disc),
                  boxShadow: disc ? (isWinningCell ? "0 0 0 3px #fff, 0 2px 6px rgba(0,0,0,0.4)" : "0 2px 6px rgba(0,0,0,0.4)") : "none",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Seat indicator */}
      {!state.game_over && (
        <div className="flex items-center gap-4 text-xs text-[var(--lj-muted)]">
          <span className={`flex items-center gap-1 font-semibold ${state.current_turn === "R" ? "text-red-400" : "text-[var(--lj-muted)]"}`}>
            🔴 Red {state.r_player_id === userId ? "(you)" : ""}
          </span>
          <span>vs</span>
          <span className={`flex items-center gap-1 font-semibold ${state.current_turn === "Y" ? "text-yellow-300" : "text-[var(--lj-muted)]"}`}>
            🟡 Yellow {state.y_player_id === userId ? "(you)" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
