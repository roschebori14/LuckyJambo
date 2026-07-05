"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type CSSProperties,
} from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Move } from "chess.js";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";

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
  const { play } = useSound();
  const [state, setState] = useState<ChessGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [gameOverMsg, setGameOverMsg] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

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

  // Live update: opponent's move lands instantly instead of waiting up
  // to 3s for the next poll.
  useMatchRealtime(matchId, (row) => {
    if (row.game_state) setState(row.game_state as ChessGameState);
  });

  const isWhite = state?.white_player_id === userId;
  const isBlack = state?.black_player_id === userId;
  const myTurn =
    !!state &&
    !gameOver &&
    ((isWhite && state.current_turn === "w") ||
      (isBlack && state.current_turn === "b"));

  // chess.js instance derived from the authoritative FEN, used purely
  // client-side to compute legal moves for tap-to-move highlighting and
  // to reject illegal drag-drops before they ever hit the network. The
  // server re-validates every move from its own copy of the position -
  // this is a UX aid, not a trust boundary.
  const chessGame = useMemo(() => {
    if (!state) return null;
    try {
      return new Chess(state.fen);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the FEN affects legality
  }, [state?.fen]);

  const legalMoves: Move[] = useMemo(() => {
    if (!chessGame || !myTurn) return [];
    try {
      return chessGame.moves({ verbose: true });
    } catch {
      return [];
    }
  }, [chessGame, myTurn]);

  const selectableSquares = useMemo(
    () => new Set<string>(legalMoves.map((m) => m.from)),
    [legalMoves],
  );
  const movesFromSelected = useMemo(
    () => (selected ? legalMoves.filter((m) => m.from === selected) : []),
    [legalMoves, selected],
  );
  const destinationSquares = useMemo(
    () => new Set(movesFromSelected.map((m) => m.to)),
    [movesFromSelected],
  );

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (selected)
      styles[selected] = { backgroundColor: "rgba(59,130,246,0.45)" };
    destinationSquares.forEach((sq) => {
      styles[sq] = {
        background:
          "radial-gradient(circle, rgba(34,197,94,0.55) 22%, transparent 23%)",
      };
    });
    return styles;
  }, [selected, destinationSquares]);

  // Single async move path shared by both drag-and-drop and tap-to-move.
  // Auto-queens on promotion, matching prior drag-only behavior (no
  // underpromotion picker yet).
  async function submitMove(from: string, to: string, promotion?: string) {
    if (!state || gameOver || moving) return;
    setMoving(true);
    setError("");
    try {
      const res = await fetch("/api/chess/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, from, to, promotion }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message);
        fetchState();
        return;
      }
      play("move");
      setState((prev) =>
        prev
          ? {
              ...prev,
              fen: json.fen,
              current_turn: prev.current_turn === "w" ? "b" : "w",
            }
          : null,
      );
      if (json.game_over) {
        setGameOver(true);
        setGameOverMsg(json.draw ? "Draw — stakes refunded." : "Checkmate!");
      }
    } finally {
      setSelected(null);
      setMoving(false);
    }
  }

  // onPieceDrop must return synchronously per react-chessboard's contract.
  // We validate the move against the client-side legal-move list first
  // (so an illegal drag snaps back immediately instead of animating to
  // the target and only correcting itself after a round trip), then
  // fire the async submit.
  function handleDrop(sourceSquare: string, targetSquare: string): boolean {
    if (!state || gameOver || moving || !myTurn) return false;
    const destMove = legalMoves.find(
      (m) =>
        m.from === sourceSquare &&
        m.to === targetSquare &&
        (!m.promotion || m.promotion === "q"),
    );
    if (!destMove) return false;
    submitMove(
      sourceSquare,
      targetSquare,
      destMove.promotion ? "q" : undefined,
    );
    return true;
  }

  // Tap-to-move: works identically on mouse and touch (react-chessboard
  // fires onSquareClick from a tap-vs-drag-aware touch handler under the
  // hood), so this is the reliable path on mobile where drag-and-drop via
  // @dnd-kit can be finicky with quick taps and page-scroll gestures.
  function handleSquareClick(square: string) {
    if (!state || gameOver || moving || !myTurn) return;

    const destMove = movesFromSelected.find(
      (m) => m.to === square && (!m.promotion || m.promotion === "q"),
    );
    if (selected && destMove) {
      submitMove(selected, square, destMove.promotion ? "q" : undefined);
      return;
    }

    if (square === selected) {
      setSelected(null);
      return;
    }

    if (selectableSquares.has(square)) {
      setSelected(square);
      setError("");
    } else {
      setSelected(null);
    }
  }

  async function resign() {
    const res = await fetch("/api/chess/resign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: matchId }),
    });
    const json = await res.json();
    if (json.success) {
      setGameOver(true);
      setGameOverMsg("You resigned.");
    } else setError(json.message);
  }

  if (loading)
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  if (!state)
    return (
      <p className="text-center text-[var(--lj-muted)]">Failed to load game.</p>
    );

  return (
    <div className="flex flex-col gap-4">
      {gameOver ? (
        <div className="rounded-xl bg-green-500/10 px-4 py-3 text-center text-sm font-semibold text-green-300">
          {gameOverMsg}
        </div>
      ) : (
        <div
          className={`rounded-xl px-4 py-3 text-center text-sm font-semibold ${myTurn ? "bg-blue-500/10 text-blue-300" : "bg-white/5 text-[var(--lj-muted)]"}`}
        >
          {myTurn ? "Your turn" : "Waiting for opponent…"}
          <span className="ml-2 text-xs opacity-70">
            You are {isWhite ? "White ♔" : "Black ♚"}
          </span>
        </div>
      )}
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      <div className="w-full max-w-[380px] mx-auto">
        <Chessboard
          options={{
            position: state.fen,
            boardOrientation: isWhite ? "white" : "black",
            allowDragging: myTurn && !moving,
            // Restrict which pieces can even be picked up to those with a
            // legal move, so an opponent's piece (or a pinned piece) isn't
            // draggable in the first place rather than just snapping back.
            canDragPiece: ({ square }) =>
              !!square && selectableSquares.has(square),
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              if (!targetSquare) return false;
              return handleDrop(sourceSquare, targetSquare);
            },
            // Primary interaction on mobile: tap a piece, then tap a
            // destination. react-chessboard distinguishes a tap from a
            // drag/scroll gesture internally, so this is reliable on touch
            // devices even when drag-and-drop (@dnd-kit) isn't.
            onSquareClick: ({ square }) => handleSquareClick(square),
            squareStyles,
          }}
        />
      </div>
      {!gameOver && myTurn && (
        <p className="text-center text-xs text-[var(--lj-muted)]">
          Tap a piece, then tap a highlighted square to move — or drag it.
        </p>
      )}
      {!gameOver && (
        <button
          onClick={resign}
          className="mx-auto rounded-xl border border-red-200 bg-[var(--lj-card-2)] px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/10"
        >
          Resign
        </button>
      )}
    </div>
  );
}
