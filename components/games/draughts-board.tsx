"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DraughtsEngine,
  DraughtsState,
  DraughtsMove,
} from "@/lib/games/draughts-engine";
import { useMatchRealtime } from "@/hooks/use-match-realtime";

interface Props {
  matchId: string;
  userId: string;
}

// Mirrors the private toRC() in lib/games/draughts-engine.ts - dark
// squares 1-32, row-major, so we can lay them out on a visual 8x8 grid.
function toRC(pos: number): [number, number] {
  const idx = pos - 1;
  const row = Math.floor(idx / 4);
  const col = (idx % 4) * 2 + (row % 2 === 0 ? 1 : 0);
  return [row, col];
}

const PIECE_LABEL: Record<string, string> = {
  r: "●",
  R: "♛",
  b: "●",
  B: "♛",
};

export default function DraughtsBoard({ matchId, userId }: Props) {
  const [state, setState] = useState<DraughtsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/draughts/state?match_id=${matchId}`);
    const json = await res.json();
    if (json.success) setState(json.state as DraughtsState);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    fetchState();
    const t = setInterval(fetchState, 3000);
    return () => clearInterval(t);
  }, [fetchState]);

  // Live update: opponent's move lands instantly instead of waiting up
  // to 3s for the next poll.
  useMatchRealtime(matchId, (row) => {
    if (row.game_state) setState(row.game_state as DraughtsState);
  });

  const myColor: "r" | "b" | null = useMemo(() => {
    if (!state) return null;
    if (state.r_player_id === userId) return "r";
    if (state.b_player_id === userId) return "b";
    return null;
  }, [state, userId]);

  const isMyTurn =
    !!state && !state.game_over && state.current_turn === myColor;

  // Legal moves are only used client-side to highlight destinations -
  // the server (apply_draughts_move_result + DraughtsEngine.makeMove
  // in the API route) is the real authority and re-validates the move
  // from the actual DB row before anything is persisted.
  const legalMoves: DraughtsMove[] = useMemo(() => {
    if (!state || !isMyTurn) return [];
    try {
      return DraughtsEngine.getLegalMoves(state);
    } catch {
      return [];
    }
  }, [state, isMyTurn]);

  const movesFromSelected = useMemo(
    () => legalMoves.filter((m) => m.from === selected),
    [legalMoves, selected],
  );
  const selectablePositions = useMemo(
    () => new Set(legalMoves.map((m) => m.from)),
    [legalMoves],
  );

  async function submitMove(move: DraughtsMove) {
    setMoving(true);
    setError("");
    try {
      const res = await fetch("/api/draughts/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: matchId,
          from: move.from,
          to: move.to,
          captures: move.captures,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setState(json.state as DraughtsState);
      } else {
        setError(json.message);
        fetchState();
      }
    } finally {
      setSelected(null);
      setMoving(false);
    }
  }

  function handleSquareClick(pos: number) {
    if (!state || !isMyTurn || moving) return;

    const destinationMove = movesFromSelected.find((m) => m.to === pos);
    if (selected !== null && destinationMove) {
      submitMove(destinationMove);
      return;
    }

    const piece = state.board[pos];
    if (piece && selectablePositions.has(pos)) {
      setSelected(pos);
      setError("");
    } else if (piece) {
      // Standard checkers rule: if ANY piece has a capture available,
      // every non-capturing piece becomes unselectable. Without this
      // message, tapping one of those pieces just silently does
      // nothing - which reads exactly like a broken control, not a
      // rules-mandated restriction the player isn't aware of.
      const mandatoryCapture = legalMoves.some((m) => m.captures.length > 0);
      setError(
        mandatoryCapture
          ? "You have a capture available elsewhere on the board - captures are mandatory."
          : "That piece has no legal moves right now.",
      );
      setSelected(null);
    } else {
      setSelected(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (!state)
    return (
      <p className="text-center text-[var(--lj-muted)]">
        Failed to load game state.
      </p>
    );

  const statusText = state.game_over
    ? state.winner === myColor
      ? "🏆 You won!"
      : "😔 You lost."
    : isMyTurn
      ? "Your turn"
      : "Waiting for opponent…";

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Status */}
      <div
        className={`w-full rounded-xl px-4 py-3 text-center text-sm font-semibold ${
          state.game_over
            ? state.winner === myColor
              ? "bg-green-500/10 text-green-300"
              : "bg-red-500/10 text-red-300"
            : isMyTurn
              ? "bg-blue-500/10 text-blue-300"
              : "bg-white/5 text-[var(--lj-muted)]"
        }`}
      >
        {statusText}
        <span className="ml-2 text-xs opacity-70">
          You are {myColor === "r" ? "Red" : "Black"}
        </span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Board: 8x8 grid, only dark squares are playable */}
      <div className="grid grid-cols-8 gap-[2px] w-full max-w-[360px] aspect-square rounded-lg overflow-hidden border border-[var(--lj-border)]">
        {Array.from({ length: 64 }, (_, i) => {
          const row = Math.floor(i / 8);
          const col = i % 8;
          const isDark = (row + col) % 2 === 1;

          if (!isDark) {
            return <div key={i} className="bg-white/5" />;
          }

          // Find which numbered dark square (1-32) this row/col is
          let pos = -1;
          for (let p = 1; p <= 32; p++) {
            const [r, c] = toRC(p);
            if (r === row && c === col) {
              pos = p;
              break;
            }
          }

          const piece = pos > 0 ? state.board[pos] : undefined;
          const isSelected = selected === pos;
          const isDestination =
            selected !== null && movesFromSelected.some((m) => m.to === pos);
          const isSelectable =
            isMyTurn && !!piece && selectablePositions.has(pos);
          const pieceIsRed = piece === "r" || piece === "R";

          return (
            <button
              key={i}
              onClick={() => pos > 0 && handleSquareClick(pos)}
              disabled={!isMyTurn || moving}
              className={`relative flex items-center justify-center transition-colors ${
                isSelected
                  ? "bg-blue-500/40"
                  : isDestination
                    ? "bg-green-500/30"
                    : "bg-[var(--lj-card-2)]"
              } ${isSelectable ? "cursor-pointer hover:bg-blue-500/20" : "cursor-default"}`}
            >
              {piece && (
                <span
                  className={`flex h-[70%] w-[70%] items-center justify-center rounded-full text-lg font-bold shadow-sm ${
                    pieceIsRed
                      ? "bg-red-500 text-red-950"
                      : "bg-neutral-800 text-neutral-200 border border-neutral-600"
                  }`}
                >
                  {PIECE_LABEL[piece]}
                </span>
              )}
              {!piece && isDestination && (
                <span className="h-3 w-3 rounded-full bg-green-400/70" />
              )}
            </button>
          );
        })}
      </div>

      {/* Turn indicator */}
      {!state.game_over && (
        <div className="flex items-center gap-4 text-xs text-[var(--lj-muted)]">
          <span
            className={`flex items-center gap-1 font-semibold ${state.current_turn === "b" ? "text-neutral-200" : "text-[var(--lj-muted)]"}`}
          >
            ● Black {state.b_player_id === userId ? "(you)" : ""}
          </span>
          <span>vs</span>
          <span
            className={`flex items-center gap-1 font-semibold ${state.current_turn === "r" ? "text-red-400" : "text-[var(--lj-muted)]"}`}
          >
            ● Red {state.r_player_id === userId ? "(you)" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
