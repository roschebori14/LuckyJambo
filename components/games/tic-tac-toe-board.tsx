"use client";

import { useState, useEffect, useCallback } from "react";

interface TicState {
  board: Array<"X" | "O" | null>;
  current_turn: "X" | "O";
  winner: "X" | "O" | null;
  is_draw: boolean;
  game_over: boolean;
  x_player_id: string;
  o_player_id: string;
}

interface Props {
  matchId: string;
  userId: string;
}

export default function TicTacToeBoard({ matchId, userId }: Props) {
  const [state, setState] = useState<TicState | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/tictactoe/state?match_id=${matchId}`);
    const json = await res.json();
    if (json.success) setState(json.state);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  async function makeMove(cellIndex: number) {
    if (!state || state.game_over || moving) return;
    const mySymbol = state.x_player_id === userId ? "X" : "O";
    if (state.current_turn !== mySymbol) return;
    if (state.board[cellIndex] !== null) return;

    setMoving(true);
    setError("");
    try {
      const res = await fetch("/api/tictactoe/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, cell_index: cellIndex }),
      });
      const json = await res.json();
      if (json.success) setState(json.state);
      else setError(json.message);
    } finally {
      setMoving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (!state) return <p className="text-center text-gray-500">Failed to load game state.</p>;

  const mySymbol = state.x_player_id === userId ? "X" : "O";
  const isMyTurn = state.current_turn === mySymbol && !state.game_over;

  const statusText = state.game_over
    ? state.is_draw
      ? "It's a draw! Stakes refunded."
      : state.winner === mySymbol
      ? "🏆 You won!"
      : "😔 You lost."
    : isMyTurn
    ? "Your turn"
    : "Waiting for opponent…";

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Status */}
      <div className={`w-full rounded-xl px-4 py-3 text-center text-sm font-semibold ${
        state.game_over
          ? state.winner === mySymbol ? "bg-green-50 text-green-700" : state.is_draw ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"
          : isMyTurn ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"
      }`}>
        {statusText}
        <span className="ml-2 text-xs opacity-70">You are {mySymbol}</span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Board */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-[280px]">
        {state.board.map((cell, i) => (
          <button
            key={i}
            onClick={() => makeMove(i)}
            disabled={!!cell || !isMyTurn || moving}
            className={`aspect-square rounded-xl text-3xl font-extrabold transition-all ${
              cell === "X" ? "bg-blue-100 text-blue-600" :
              cell === "O" ? "bg-red-100 text-red-600" :
              isMyTurn && !cell ? "bg-gray-100 hover:bg-green-50 active:scale-95 cursor-pointer" : "bg-gray-100"
            } disabled:cursor-default`}
          >
            {cell}
          </button>
        ))}
      </div>

      {/* Turn indicator */}
      {!state.game_over && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className={`flex items-center gap-1 font-semibold ${state.current_turn === "X" ? "text-blue-600" : "text-gray-400"}`}>
            ✖ X {state.x_player_id === userId ? "(you)" : ""}
          </span>
          <span>vs</span>
          <span className={`flex items-center gap-1 font-semibold ${state.current_turn === "O" ? "text-red-600" : "text-gray-400"}`}>
            ○ O {state.o_player_id === userId ? "(you)" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
