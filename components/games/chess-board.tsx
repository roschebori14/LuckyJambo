"use client";

import { useState, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";

interface ChessBoardProps {
  matchId: string;
  userId: string;
}

interface ChessGameState {
  fen: string;
  current_turn: string;
  white_player_id: string;
  black_player_id: string | null;
}

export default function ChessBoard({ matchId, userId }: ChessBoardProps) {
  const [state, setState] = useState<ChessGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [gameOverMsg, setGameOverMsg] = useState("");

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/chess/state?match_id=${matchId}`);
    const json = await res.json();
    if (json.success) setState(json.game_state as ChessGameState);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    fetchState();
    const t = setInterval(fetchState, 3000);
    return () => clearInterval(t);
  }, [fetchState]);

  // onPieceDrop must be synchronous per react-chessboard contract.
  // We fire-and-forget the fetch and update state when it resolves.
  function handleDrop(sourceSquare: string, targetSquare: string): boolean {
    if (!state || gameOver) return false;
    const isWhite = state.white_player_id === userId;
    const isBlack = state.black_player_id === userId;
    if (!isWhite && !isBlack) return false;
    if ((state.current_turn === "w" && !isWhite) || (state.current_turn === "b" && !isBlack)) return false;

    // Optimistically allow (chess.js on server will validate; if illegal it returns success:false)
    fetch("/api/chess/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: matchId, from: sourceSquare, to: targetSquare }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) { setError(json.message); fetchState(); return; }
        setState((prev) => prev ? { ...prev, fen: json.fen, current_turn: prev.current_turn === "w" ? "b" : "w" } : null);
        if (json.game_over) { setGameOver(true); setGameOverMsg(json.draw ? "Draw — stakes refunded." : "Checkmate!"); }
        setError("");
      });

    return true; // always return true so the piece animates to target
  }

  async function resign() {
    const res = await fetch("/api/chess/resign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: matchId }),
    });
    const json = await res.json();
    if (json.success) { setGameOver(true); setGameOverMsg("You resigned."); }
    else setError(json.message);
  }

  if (loading) return <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" /></div>;
  if (!state) return <p className="text-center text-gray-500">Failed to load game.</p>;

  const isWhite = state.white_player_id === userId;
  const myTurn = !gameOver && ((isWhite && state.current_turn === "w") || (!isWhite && state.current_turn === "b"));

  return (
    <div className="flex flex-col gap-4">
      {gameOver ? (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-700">{gameOverMsg}</div>
      ) : (
        <div className={`rounded-xl px-4 py-3 text-center text-sm font-semibold ${myTurn ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"}`}>
          {myTurn ? "Your turn" : "Waiting for opponent…"}
          <span className="ml-2 text-xs opacity-70">You are {isWhite ? "White ♔" : "Black ♚"}</span>
        </div>
      )}
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      <div className="w-full max-w-[380px] mx-auto">
        <Chessboard
          options={{
            position: state.fen,
            boardOrientation: isWhite ? "white" : "black",
            allowDragging: myTurn,
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              if (!targetSquare) return false;
              return handleDrop(sourceSquare, targetSquare);
            },
          }}
        />
      </div>
      {!gameOver && (
        <button onClick={resign} className="mx-auto rounded-xl border border-red-200 bg-white px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
          Resign
        </button>
      )}
    </div>
  );
}
