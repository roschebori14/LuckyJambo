"use client";

import { useState, useEffect, useCallback } from "react";

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
  const [submitted, setSubmitted] = useState(false);
  const [move, setMove] = useState("");
  const [result, setResult] = useState<{ status: string; you_won?: boolean; winner_id?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matchReady, setMatchReady] = useState(false);

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

  async function submitMove(selectedMove: string) {
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
      if (json.result?.status === "resolved") {
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
      if (json.result?.status === "resolved") {
        setResult(json.result);
        clearInterval(t);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [submitted, result, matchId, move]);

  if (!matchReady) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
        <p className="text-sm text-gray-500">Waiting for an opponent to join…</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className={`rounded-2xl p-6 text-center ${result.you_won ? "bg-green-50" : "bg-red-50"}`}>
        <div className="text-5xl mb-3">{result.you_won ? "🏆" : "😔"}</div>
        <h2 className="text-xl font-extrabold text-gray-900">
          {result.you_won ? "You Won!" : "You Lost"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {result.you_won ? "Prize paid to your wallet." : "Better luck next time."}
        </p>
        <a href="/games" className="mt-4 inline-block rounded-xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white">
          Play Again
        </a>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
        <p className="font-semibold text-gray-700">Move submitted!</p>
        <p className="text-sm text-gray-400">Waiting for your opponent to play…</p>
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
      <p className="text-sm font-semibold text-gray-700">Make your move:</p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {gameType === "dice_duel" ? (
        <div className="text-center">
          <p className="mb-4 text-4xl">🎲</p>
          <p className="mb-6 text-sm text-gray-500">The server rolls for both players — may the higher number win!</p>
          <button
            onClick={() => submitMove("roll")}
            disabled={loading}
            className="rounded-xl bg-green-600 px-8 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Rolling…" : "Roll the Dice!"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
          {choices!.map((c) => (
            <button
              key={c.value}
              onClick={() => submitMove(c.value)}
              disabled={loading}
              className="rounded-xl border-2 border-gray-200 bg-white px-6 py-4 text-base font-semibold text-gray-800 transition-all hover:border-green-400 hover:bg-green-50 active:scale-95 disabled:opacity-50"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
