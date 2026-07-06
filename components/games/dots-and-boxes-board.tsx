"use client";

import { useState, useEffect, useCallback } from "react";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";
import { useMatchResultSound } from "@/lib/sound/use-match-result-sound";
import type { DotsAndBoxesState } from "@/types/dots-and-boxes";

const BOX_ROWS = 4;
const BOX_COLS = 4;
const DOT_GAP = 44; // px between dots, drives the whole board's size

interface Props {
  matchId: string;
  userId: string;
}

export default function DotsAndBoxesBoard({ matchId, userId }: Props) {
  const { play } = useSound();
  const [state, setState] = useState<DotsAndBoxesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/dots-and-boxes/state?match_id=${matchId}`);
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
    if (row.game_state) setState(row.game_state as DotsAndBoxesState);
  });

  const mySeat = state ? (state.r_player_id === userId ? "R" : "Y") : null;
  const isMyTurn = !!state && !state.game_over && state.current_turn === mySeat;
  const won = !!state && state.winner === mySeat;

  useMatchResultSound(
    state?.game_over
      ? { status: state.is_draw ? "draw" : "resolved", you_won: won }
      : null,
  );

  async function drawLine(lineType: "h" | "v", lineIndex: number) {
    if (!state || state.game_over || moving || !isMyTurn) return;
    const already = lineType === "h" ? state.h_lines[lineIndex] : state.v_lines[lineIndex];
    if (already) return;

    setMoving(true);
    setError("");
    try {
      const res = await fetch("/api/dots-and-boxes/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, line_type: lineType, line_index: lineIndex }),
      });
      const json = await res.json();
      if (json.success) {
        // A completed box gets its own, more satisfying sound; a plain
        // line draw gets the same generic "move" sound every other
        // board uses.
        const prevScore = (state.scores.R ?? 0) + (state.scores.Y ?? 0);
        const nextScore = (json.state.scores.R ?? 0) + (json.state.scores.Y ?? 0);
        play(nextScore > prevScore ? "box-complete" : "move");
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

  const seatColor = (seat: "R" | "Y" | null) => (seat === "R" ? "#ff3d5a" : seat === "Y" ? "#ffd700" : "transparent");

  const statusText = state.game_over
    ? state.is_draw
      ? "It's a draw! Stakes refunded."
      : won
      ? "🏆 You won!"
      : "😔 You lost."
    : isMyTurn
    ? "Your turn — draw a line"
    : "Waiting for opponent…";

  const boardWidth = BOX_COLS * DOT_GAP;
  const boardHeight = BOX_ROWS * DOT_GAP;

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

      {/* Score */}
      <div className="flex items-center gap-6 text-sm font-bold">
        <span style={{ color: "#ff3d5a" }}>🔴 {state.scores.R}</span>
        <span className="text-[var(--lj-muted)]">boxes</span>
        <span style={{ color: "#ffd700" }}>🟡 {state.scores.Y}</span>
      </div>

      {/* Board: dots grid with clickable line segments and filled boxes */}
      <div
        className="relative rounded-2xl p-6"
        style={{ width: boardWidth + 48, height: boardHeight + 48, background: "rgba(4,9,26,0.35)" }}
      >
        <div className="relative" style={{ width: boardWidth, height: boardHeight }}>
          {/* Completed boxes */}
          {state.box_owners.map((owner, i) => {
            if (!owner) return null;
            const row = Math.floor(i / BOX_COLS);
            const col = i % BOX_COLS;
            return (
              <div
                key={`box-${i}`}
                className="absolute rounded-md transition-opacity"
                style={{
                  left: col * DOT_GAP + 6,
                  top: row * DOT_GAP + 6,
                  width: DOT_GAP - 12,
                  height: DOT_GAP - 12,
                  background: seatColor(owner),
                  opacity: 0.28,
                }}
              />
            );
          })}

          {/* Horizontal line buttons: 5 rows x 4 cols */}
          {state.h_lines.map((owner, i) => {
            const row = Math.floor(i / BOX_COLS);
            const col = i % BOX_COLS;
            const clickable = isMyTurn && !owner && !moving;
            return (
              <button
                key={`h-${i}`}
                onClick={() => drawLine("h", i)}
                disabled={!clickable}
                aria-label={`Horizontal line, row ${row + 1}, column ${col + 1}`}
                className="absolute rounded-full transition-colors"
                style={{
                  left: col * DOT_GAP + 4,
                  top: row * DOT_GAP - 3,
                  width: DOT_GAP - 8,
                  height: 6,
                  background: owner ? seatColor(owner) : clickable ? "rgba(96,165,250,0.35)" : "rgba(255,255,255,0.08)",
                  cursor: clickable ? "pointer" : "default",
                }}
              />
            );
          })}

          {/* Vertical line buttons: 4 rows x 5 cols */}
          {state.v_lines.map((owner, i) => {
            const row = Math.floor(i / (BOX_COLS + 1));
            const col = i % (BOX_COLS + 1);
            const clickable = isMyTurn && !owner && !moving;
            return (
              <button
                key={`v-${i}`}
                onClick={() => drawLine("v", i)}
                disabled={!clickable}
                aria-label={`Vertical line, row ${row + 1}, column ${col + 1}`}
                className="absolute rounded-full transition-colors"
                style={{
                  left: col * DOT_GAP - 3,
                  top: row * DOT_GAP + 4,
                  width: 6,
                  height: DOT_GAP - 8,
                  background: owner ? seatColor(owner) : clickable ? "rgba(96,165,250,0.35)" : "rgba(255,255,255,0.08)",
                  cursor: clickable ? "pointer" : "default",
                }}
              />
            );
          })}

          {/* Dots */}
          {Array.from({ length: (BOX_ROWS + 1) * (BOX_COLS + 1) }).map((_, i) => {
            const row = Math.floor(i / (BOX_COLS + 1));
            const col = i % (BOX_COLS + 1);
            return (
              <div
                key={`dot-${i}`}
                className="absolute rounded-full bg-white"
                style={{
                  left: col * DOT_GAP - 4,
                  top: row * DOT_GAP - 4,
                  width: 8,
                  height: 8,
                }}
              />
            );
          })}
        </div>
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
          {isMyTurn && (
            <span className="ml-2 rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-300">
              Complete a box to go again!
            </span>
          )}
        </div>
      )}
    </div>
  );
}
