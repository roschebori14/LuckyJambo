"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Trophy, Frown } from "lucide-react";
import {
  DraughtsEngine,
  DraughtsState,
  DraughtsMove,
  DraughtsPiece,
} from "@/lib/games/draughts-engine";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";

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

// Mirrors the private pieceColor() in the engine - not exported, so
// duplicated here the same way toRC() already was.
function pieceColor(piece: DraughtsPiece): "r" | "b" {
  return piece === "r" || piece === "R" ? "r" : "b";
}

function isKing(piece: DraughtsPiece): boolean {
  return piece === "R" || piece === "B";
}

const PIECE_LABEL: Record<string, string> = { r: "", R: "♛", b: "", B: "♛" };

interface Token {
  id: string;
  pos: number;
  piece: DraughtsPiece;
  fading?: boolean;
}

interface DiffedMove {
  from: number;
  to: number;
  captures: number[];
}

// Reconstructs what move just happened purely by diffing two board
// snapshots - the server only ever hands us before/after boards (no
// move object on poll/realtime updates), so this lets both our own
// moves and the opponent's moves animate through the same code path.
function diffMove(
  prevBoard: Record<number, DraughtsPiece>,
  nextBoard: Record<number, DraughtsPiece>,
): DiffedMove | null {
  const gone = Object.keys(prevBoard)
    .map(Number)
    .filter((p) => !(p in nextBoard));
  const arrived = Object.keys(nextBoard)
    .map(Number)
    .filter((p) => !(p in prevBoard));

  if (arrived.length !== 1 || gone.length === 0) return null;

  const to = arrived[0];
  const moverColor = pieceColor(nextBoard[to]);
  const from = gone.find((p) => pieceColor(prevBoard[p]) === moverColor);
  if (from === undefined) return null;

  return { from, to, captures: gone.filter((p) => p !== from) };
}

export default function DraughtsBoard({ matchId, userId }: Props) {
  const { play } = useSound();
  const [state, setState] = useState<DraughtsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [invalidFlash, setInvalidFlash] = useState<number | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [lastMove, setLastMove] = useState<DiffedMove | null>(null);
  const [promoFlash, setPromoFlash] = useState<number | null>(null);
  const [log, setLog] = useState<
    (DiffedMove & { key: string; mover: "r" | "b" })[]
  >([]);
  const [showResult, setShowResult] = useState(false);

  const boardRef = useRef<Record<number, DraughtsPiece> | null>(null);
  const prevGameOver = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function queue(fn: () => void, delay: number) {
    timers.current.push(setTimeout(fn, delay));
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/draughts/state?match_id=${matchId}`);
    const json = await res.json();
    if (json.success) applyState(json.state as DraughtsState);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    fetchState();
    const t = setInterval(fetchState, 3000);
    return () => clearInterval(t);
  }, [fetchState]);

  useMatchRealtime(matchId, (row) => {
    if (row.game_state) applyState(row.game_state as DraughtsState);
  });

  function applyState(next: DraughtsState) {
    const prevBoard = boardRef.current;

    if (!prevBoard) {
      setTokens(
        Object.entries(next.board).map(([pos, piece]) => ({
          id: `p${pos}`,
          pos: Number(pos),
          piece,
        })),
      );
    } else if (JSON.stringify(prevBoard) !== JSON.stringify(next.board)) {
      const diff = diffMove(prevBoard, next.board);
      if (diff) {
        const { from, to, captures } = diff;
        let justPromoted = false;

        setTokens((prev) => {
          const updated = prev.map((t) => {
            if (t.pos === from) {
              if (!isKing(t.piece) && isKing(next.board[to]))
                justPromoted = true;
              return { ...t, pos: to, piece: next.board[to] };
            }
            return t;
          });
          return updated.map((t) =>
            captures.includes(t.pos) && t.pos !== to
              ? { ...t, fading: true }
              : t,
          );
        });

        setLastMove(diff);
        setLog((l) =>
          [
            {
              ...diff,
              key: `${from}-${to}-${l.length}`,
              mover: pieceColor(next.board[to]),
            },
            ...l,
          ].slice(0, 8),
        );

        if (justPromoted) {
          queue(() => setPromoFlash(to), 180);
          queue(() => setPromoFlash(null), 900);
        }
        if (captures.length > 0) {
          queue(() => setTokens((prev) => prev.filter((t) => !t.fading)), 380);
        }
      } else {
        // Couldn't reconstruct a clean single move (e.g. resign/edge
        // case) - just resync tokens directly, no animation.
        setTokens(
          Object.entries(next.board).map(([pos, piece]) => ({
            id: `p${pos}`,
            pos: Number(pos),
            piece,
          })),
        );
      }
    }

    boardRef.current = next.board;
    setState(next);
  }

  useEffect(() => {
    if (state?.game_over && !prevGameOver.current) {
      queue(() => setShowResult(true), 500);
    }
    prevGameOver.current = !!state?.game_over;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.game_over]);

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
        play("move");
        applyState(json.state as DraughtsState);
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
      const mandatoryCapture = legalMoves.some((m) => m.captures.length > 0);
      setError(
        mandatoryCapture
          ? "You have a capture available elsewhere on the board - captures are mandatory."
          : "That piece has no legal moves right now.",
      );
      setSelected(null);
      // Flash which square actually registered the tap (in a
      // distinct color from a real selection) so a mis-tap on mobile
      // is immediately obvious instead of looking like nothing happened.
      setInvalidFlash(pos);
      queue(() => setInvalidFlash(null), 400);
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
    <div className="flex flex-col items-center gap-4">
      <style>{`
        @keyframes dr-confetti-fall {
          0% { transform: translateY(-10%) rotate(0deg); opacity: 1; }
          100% { transform: translateY(420%) rotate(340deg); opacity: 0; }
        }
        @keyframes dr-promo-flash {
          0% { transform: scale(1); filter: brightness(1) drop-shadow(0 0 0 rgba(250,204,21,0)); }
          40% { transform: scale(1.5); filter: brightness(1.8) drop-shadow(0 0 6px rgba(250,204,21,0.9)); }
          100% { transform: scale(1); filter: brightness(1) drop-shadow(0 0 0 rgba(250,204,21,0)); }
        }
        @keyframes dr-pop-in {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes dr-capture-fade {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.2); opacity: 0; }
        }
      `}</style>

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

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {/* Board - sized responsively so squares stay well above the
          ~44px minimum touch target on real phones, instead of a
          fixed 360px box that made mis-taps common on mobile. */}
      <div
        className="relative w-full rounded-lg border border-[var(--lj-border)] overflow-hidden"
        style={{
          maxWidth: "min(92vw, 480px)",
          aspectRatio: "1 / 1",
          touchAction: "manipulation",
        }}
      >
        <div className="grid h-full w-full grid-cols-8 gap-[2px]">
          {Array.from({ length: 64 }, (_, i) => {
            const row = Math.floor(i / 8);
            const col = i % 8;
            const isDark = (row + col) % 2 === 1;

            if (!isDark) return <div key={i} className="bg-white/5" />;

            let pos = -1;
            for (let p = 1; p <= 32; p++) {
              const [r, c] = toRC(p);
              if (r === row && c === col) {
                pos = p;
                break;
              }
            }

            const isSelected = selected === pos;
            const isInvalidFlash = invalidFlash === pos;
            const isDestination =
              selected !== null && movesFromSelected.some((m) => m.to === pos);
            const isSelectable =
              isMyTurn && !!state.board[pos] && selectablePositions.has(pos);
            const isLastMoveSquare =
              lastMove && (lastMove.from === pos || lastMove.to === pos);

            return (
              <button
                key={i}
                onClick={() => pos > 0 && handleSquareClick(pos)}
                disabled={!isMyTurn || moving}
                className={`relative flex select-none items-center justify-center transition-colors ${
                  isInvalidFlash
                    ? "bg-red-500/40"
                    : isSelected
                      ? "bg-blue-500/40"
                      : isDestination
                        ? "bg-green-500/30"
                        : isLastMoveSquare
                          ? "bg-yellow-400/10"
                          : "bg-[var(--lj-card-2)]"
                } ${isSelectable ? "cursor-pointer hover:bg-blue-500/20" : "cursor-default"}`}
                style={{ touchAction: "manipulation" }}
              >
                {!state.board[pos] && isDestination && (
                  <span className="h-3 w-3 rounded-full bg-green-400/70" />
                )}
              </button>
            );
          })}
        </div>

        {/* Pieces - absolutely positioned overlay, keyed by a stable
            synthetic id so React can animate a piece sliding from one
            square to another (and captured pieces fading out) instead
            of the old board simply re-rendering pieces in place. */}
        {tokens.map((t) => {
          const [row, col] = toRC(t.pos);
          const x = col * 12.5 + 6.25;
          const y = row * 12.5 + 6.25;
          const isRed = t.piece === "r" || t.piece === "R";
          const flashing = promoFlash === t.pos;

          return (
            <div
              key={t.id}
              className="pointer-events-none absolute flex items-center justify-center rounded-full text-lg font-bold shadow-md"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: "10.5%",
                height: "10.5%",
                transform: "translate(-50%, -50%)",
                transition: "left 260ms ease-in-out, top 260ms ease-in-out",
                animation: t.fading
                  ? "dr-capture-fade 320ms ease-in forwards"
                  : flashing
                    ? "dr-promo-flash 700ms ease-in-out"
                    : undefined,
                background: isRed ? "#ef4444" : "#262626",
                color: isRed ? "#450a0a" : "#e5e5e5",
                border: isRed ? "none" : "1px solid #525252",
                zIndex: 10,
              }}
            >
              {PIECE_LABEL[t.piece]}
            </div>
          );
        })}
      </div>

      {/* Move log */}
      {log.length > 0 && (
        <div className="w-full rounded-xl border border-[var(--lj-border)] bg-white/[0.03] p-2">
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--lj-muted)]">
            Recent moves
          </p>
          <ul className="max-h-24 space-y-1 overflow-y-auto text-[11px] text-[var(--lj-muted)]">
            {log.map((entry) => (
              <li
                key={entry.key}
                className="flex items-center justify-between px-1"
              >
                <span>
                  {entry.mover === myColor ? "You" : "Opponent"} (
                  {entry.mover === "r" ? "Red" : "Black"})
                </span>
                <span>
                  {entry.from} → {entry.to}
                  {entry.captures.length > 0
                    ? ` (×${entry.captures.length} captured)`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {/* Result overlay */}
      {showResult && state.game_over && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowResult(false)}
        >
          {state.winner === myColor &&
            Array.from({ length: 24 }, (_, i) => (
              <span
                key={i}
                className="absolute top-0 h-2 w-2 rounded-sm"
                style={{
                  left: `${(i * 37) % 100}%`,
                  backgroundColor: ["#facc15", "#4ade80", "#60a5fa", "#f472b6"][
                    i % 4
                  ],
                  animation: `dr-confetti-fall ${1.4 + (i % 5) * 0.2}s linear ${(i % 6) * 0.12}s forwards`,
                }}
              />
            ))}

          <div
            className="relative flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl bg-[var(--lj-card-2)] p-6 text-center shadow-2xl"
            style={{ animation: "dr-pop-in 200ms ease-out" }}
            onClick={(e) => e.stopPropagation()}
          >
            {state.winner === myColor ? (
              <Trophy size={40} className="text-yellow-400" />
            ) : (
              <Frown size={40} className="text-red-400" />
            )}
            <h3 className="text-xl font-extrabold text-white">
              {state.winner === myColor ? "You won!" : "You lost"}
            </h3>
            <p className="text-sm text-[var(--lj-muted)]">
              {state.winner === myColor
                ? "Your opponent had no legal moves left. Payout added to your wallet."
                : "You had no legal moves left. Better luck next time."}
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
