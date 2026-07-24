"use client";

import { useState, useEffect, useCallback } from "react";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import Confetti from "@/components/ui/confetti";
import { useSound } from "@/lib/sound/sound-manager";

type GameType = "rock_paper_scissors" | "dice_duel" | "coin_flip";

interface Props {
  matchId: string;
  gameType: GameType;
}

const RPS_MOVES = [
  { value: "rock",     label: "✊ Rock" },
  { value: "paper",    label: "✋ Paper" },
  { value: "scissors", label: "✌️ Scissors" },
];

const COIN_MOVES = [
  { value: "heads", label: "🪙 Heads" },
  { value: "tails", label: "🪙 Tails" },
];

export default function InstantGameBoard({ matchId, gameType }: Props) {
  const { play } = useSound();
  const [submitted, setSubmitted] = useState(false);
  const [move, setMove] = useState("");
  const [result, setResult] = useState<{ status: string; you_won?: boolean; winner_id?: string; my_roll?: number; opp_roll?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matchReady, setMatchReady] = useState(false);
  const [restoring, setRestoring] = useState(true);

  const pollMatch = useCallback(async () => {
    const res = await fetch(`/api/matches/status?id=${matchId}`);
    const json = await res.json();
    if (json.success && json.match?.status === "active") setMatchReady(true);
  }, [matchId]);

  useEffect(() => {
    pollMatch();
    const t = setInterval(pollMatch, 2000);
    return () => clearInterval(t);
  }, [pollMatch]);

  // Shared with the mount-time restore below: re-derive whether this
  // player already submitted a move and whether the match has resolved,
  // straight from the server (source of truth lives in match_moves /
  // matches, not in local state).
  const checkResult = useCallback(async () => {
    const res = await fetch(`/api/games/state?match_id=${matchId}`);
    const json = await res.json();
    if (!json.success) return;
    const r = json.result;
    if (r?.status === "resolved" || r?.status === "draw") {
      setResult(r);
      setSubmitted(true);
    } else if (r?.status === "submitted") {
      setSubmitted(true);
      setMove(r.move ?? "");
    }
  }, [matchId]);

  // Note: match-win/match-lose/match-draw sound is now fired once,
  // centrally, by GameClient (the shared parent for every game type)
  // based on the match's `status`/`winner_id` - not here. This board
  // used to call useMatchResultSound(result) itself, which duplicated
  // the sound (played twice, overlapping) once GameClient started
  // covering every game type instead of just chess/tic-tac-toe.

  // Live update: the opponent joining, or the match resolving the
  // instant both moves are in, lands immediately instead of waiting up
  // to 2s for the next poll.
  useMatchRealtime(matchId, (row) => {
    const nextStatus = row.status as string | undefined;
    if (nextStatus === "active") setMatchReady(true);
    if (nextStatus === "completed") checkResult();
  });

  // On mount (including a mid-game reload/reconnect), re-derive whether
  // this player already submitted a move and whether the match has
  // already resolved from the server, instead of trusting local state
  // that resets to "not submitted yet" on every page load. Without
  // this, a player who submits then reloads before their opponent
  // moves lands back on the move-selection screen and can get stuck
  // there forever even after the match finishes server-side.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await checkResult();
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, [checkResult]);

  async function submitMove(selectedMove: string) {
    // Fire the matching "you just acted" sound immediately on click,
    // rather than waiting on the round trip - a die/coin/choice sound
    // that lags behind the tap feels broken even at 100-200ms.
    if (gameType === "dice_duel") play("dice-roll");
    else if (gameType === "coin_flip") play("coin-flip");
    else play("button-tap"); // rock/paper/scissors choice click

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/games/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, move: selectedMove }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.message); return; }
      setMove(selectedMove);
      setSubmitted(true);
      if (json.result?.status === "resolved" || json.result?.status === "draw") {
        setResult(json.result);
      }
    } finally {
      setLoading(false);
    }
  }

  // Poll for result after submitting
  useEffect(() => {
    if (!submitted || result) return;
    const t = setInterval(async () => {
      const res = await fetch("/api/games/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, move }),
      });
      const json = await res.json();
      if (json.result?.status === "resolved" || json.result?.status === "draw") {
        setResult(json.result);
        clearInterval(t);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [submitted, result, matchId, move]);

  if (!matchReady || restoring) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
        <p className="text-sm text-[var(--lj-muted)]">Waiting for an opponent to join…</p>
      </div>
    );
  }

  if (result) {
    if (result.status === "draw") {
      return (
        <div className="rounded-2xl p-6 text-center bg-yellow-500/10">
          <div className="text-5xl mb-3">🤝</div>
          <h2 className="text-xl font-extrabold text-white">It&apos;s a draw!</h2>
          <p className="mt-1 text-sm text-[var(--lj-muted)]">Your stake was refunded to your wallet.</p>
          <a href="/games" className="mt-4 inline-block rounded-xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white">
            Play Again
          </a>
        </div>
      );
    }
    return (
      <div className={`rounded-2xl p-6 text-center ${result.you_won ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
        <Confetti fire={!!result.you_won} />
        {gameType === "dice_duel" && result.my_roll && result.opp_roll && (
          <div className="flex justify-center items-center gap-8 mb-6 mt-2">
            <style>{`
              .dice-cube { 
                position: relative; width: 60px; height: 60px; 
                transform-style: preserve-3d; transition: transform 1s ease-out;
              }
              .dice-face {
                position: absolute; width: 60px; height: 60px;
                background: linear-gradient(135deg, #1f2937, #111827);
                border: 2px solid #374151; border-radius: 12px;
                display: grid; grid-template-columns: repeat(3, 1fr);
                grid-template-rows: repeat(3, 1fr); padding: 6px;
                box-shadow: inset 0 0 15px rgba(0,0,0,0.5);
              }
              .dice-dot { width: 10px; height: 10px; border-radius: 50%; background: #60a5fa; box-shadow: 0 0 8px #60a5fa; justify-self: center; align-self: center; }
              .opp-dice .dice-dot { background: #f87171; box-shadow: 0 0 8px #f87171; }
              .front  { transform: rotateY(0deg) translateZ(30px); }
              .back   { transform: rotateY(180deg) translateZ(30px); }
              .right  { transform: rotateY(90deg) translateZ(30px); }
              .left   { transform: rotateY(-90deg) translateZ(30px); }
              .top    { transform: rotateX(90deg) translateZ(30px); }
              .bottom { transform: rotateX(-90deg) translateZ(30px); }
            `}</style>
            <div className="flex flex-col items-center gap-4">
              <span className="text-xs font-bold text-[var(--lj-muted)] uppercase tracking-wider">You Rolled</span>
              <div style={{ perspective: "600px" }}>
                <div className="dice-cube" style={{ transform: getDiceTransform(result.my_roll) }}>
                  <DiceFaces />
                </div>
              </div>
            </div>
            <div className="text-xl font-bold text-white/30 pt-6">VS</div>
            <div className="flex flex-col items-center gap-4">
              <span className="text-xs font-bold text-[var(--lj-muted)] uppercase tracking-wider">They Rolled</span>
              <div style={{ perspective: "600px" }}>
                <div className="dice-cube opp-dice" style={{ transform: getDiceTransform(result.opp_roll) }}>
                  <DiceFaces />
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="text-5xl mb-3">{result.you_won ? "🏆" : "😔"}</div>
        <h2 className="text-2xl font-extrabold text-white">
          {result.you_won ? "You Won!" : "You Lost"}
        </h2>
        <p className="mt-1 text-sm text-[var(--lj-muted)]">
          {result.you_won ? "Prize paid to your wallet." : "Better luck next time."}
        </p>
        <a href="/games" className="mt-6 inline-block rounded-xl bg-green-600 px-8 py-3 text-sm font-bold text-white hover:bg-green-700 transition-colors shadow-lg">
          Play Again
        </a>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
        <p className="font-semibold text-[var(--lj-text)]">Move submitted!</p>
        <p className="text-sm text-[var(--lj-muted)]">Waiting for your opponent to play…</p>
      </div>
    );
  }

  // Move selection UI
  const choices =
    gameType === "rock_paper_scissors" ? RPS_MOVES :
    gameType === "coin_flip" ? COIN_MOVES :
    null; // dice_duel has no player input

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm font-semibold text-[var(--lj-text)]">Make your move:</p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {gameType === "dice_duel" ? (
        <div className="text-center flex flex-col items-center">
          <style>{`
            .dice-container { perspective: 800px; }
            .dice-cube-large { 
              position: relative; width: 80px; height: 80px; 
              transform-style: preserve-3d; transition: transform 1s ease-out;
            }
            .dice-cube-large.rolling {
              animation: spinDice 0.6s infinite linear;
            }
            @keyframes spinDice {
              0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
              100% { transform: rotateX(360deg) rotateY(720deg) rotateZ(360deg); }
            }
            .dice-face-large {
              position: absolute; width: 80px; height: 80px;
              background: linear-gradient(135deg, #1f2937, #111827);
              border: 2px solid #374151; border-radius: 12px;
              display: grid; grid-template-columns: repeat(3, 1fr);
              grid-template-rows: repeat(3, 1fr); padding: 8px;
              box-shadow: inset 0 0 15px rgba(0,0,0,0.5);
            }
            .dice-dot-large { width: 12px; height: 12px; border-radius: 50%; background: #60a5fa; box-shadow: 0 0 8px #60a5fa; justify-self: center; align-self: center; }
            .front-large  { transform: rotateY(0deg) translateZ(40px); }
            .back-large   { transform: rotateY(180deg) translateZ(40px); }
            .right-large  { transform: rotateY(90deg) translateZ(40px); }
            .left-large   { transform: rotateY(-90deg) translateZ(40px); }
            .top-large    { transform: rotateX(90deg) translateZ(40px); }
            .bottom-large { transform: rotateX(-90deg) translateZ(40px); }
          `}</style>
          
          <div className="dice-container mb-8 h-24 flex items-center justify-center">
            <div className={`dice-cube-large ${loading || submitted ? 'rolling' : ''}`} style={{ transform: !loading && !submitted ? 'rotateX(-20deg) rotateY(25deg)' : '' }}>
              <DiceFacesLarge />
            </div>
          </div>
          
          <p className="mb-6 text-sm font-medium text-[var(--lj-muted)] max-w-[200px]">
            {loading || submitted ? "Rolling the dice..." : "The highest roll wins the duel!"}
          </p>
          
          {!submitted && (
            <button
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([30, 50, 30, 50, 30]);
                submitMove("roll");
              }}
              disabled={loading}
              className="rounded-xl bg-blue-600 px-10 py-4 font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] transition-all active:scale-95 text-lg"
            >
              Roll the Dice
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
          {choices!.map((c) => (
            <button
              key={c.value}
              onClick={() => submitMove(c.value)}
              disabled={loading}
              className="rounded-xl border-2 border-[var(--lj-border)] bg-[var(--lj-card-2)] px-6 py-4 text-base font-semibold text-white transition-all hover:border-green-400 hover:bg-green-500/10 active:scale-95 disabled:opacity-50"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
