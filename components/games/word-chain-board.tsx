"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";
import { useMatchResultSound } from "@/lib/sound/use-match-result-sound";
import type { WordChainState } from "@/types/word-chain";

interface Props {
  matchId: string;
  userId: string;
}

export default function WordChainBoard({ matchId, userId }: Props) {
  const { play } = useSound();
  const [state, setState] = useState<WordChainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [input, setInput] = useState("");
  const [rejection, setRejection] = useState("");
  const chainEndRef = useRef<HTMLDivElement>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/word-chain/state?match_id=${matchId}`);
    const json = await res.json();
    if (json.success) setState(json.state);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Live update: opponent's word (or strike) lands instantly instead of
  // waiting up to 3s for the next poll.
  useMatchRealtime(matchId, (row) => {
    if (row.game_state) setState(row.game_state as WordChainState);
  });

  useEffect(() => {
    chainEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.chain.length]);

  const mySeat = state ? (state.a_player_id === userId ? "A" : "B") : null;
  const isMyTurn = !!state && !state.game_over && state.current_turn === mySeat;
  const won = !!state && state.winner === mySeat;

  useMatchResultSound(
    state?.game_over ? { status: "resolved", you_won: won } : null,
  );

  async function submitWord(e: React.FormEvent) {
    e.preventDefault();
    if (!state || state.game_over || submitting || !isMyTurn) return;
    const word = input.trim();
    if (!word) return;

    setSubmitting(true);
    setRejection("");
    try {
      const res = await fetch("/api/word-chain/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, word }),
      });
      const json = await res.json();
      if (json.success) {
        setState(json.state);
        if (json.word_accepted) {
          play("move");
          setInput("");
        } else {
          play("word-rejected");
          setRejection(json.reason ?? "That word wasn't accepted");
          // Deliberately not clearing the input - most rejections
          // (wrong letter, too short) are worth letting them edit
          // rather than retype from scratch.
        }
      } else {
        setRejection(json.message ?? "Move failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (!state) return <p className="text-center text-[var(--lj-muted)]">Failed to load game state.</p>;

  const opponentSeat = mySeat === "A" ? "B" : "A";
  const myStrikes = mySeat === "A" ? state.strikes_a : state.strikes_b;
  const opponentStrikes = mySeat === "A" ? state.strikes_b : state.strikes_a;

  const statusText = state.game_over
    ? won
      ? "🏆 You won!"
      : "😔 You lost."
    : isMyTurn
    ? "Your turn"
    : "Waiting for opponent…";

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Status */}
      <div
        className={`w-full rounded-xl px-4 py-3 text-center text-sm font-semibold ${
          state.game_over
            ? won
              ? "bg-green-500/10 text-green-300"
              : "bg-red-500/10 text-red-300"
            : isMyTurn
            ? "bg-blue-500/10 text-blue-300"
            : "bg-white/5 text-[var(--lj-muted)]"
        }`}
      >
        {statusText}
      </div>

      {/* Strikes */}
      <div className="flex w-full items-center justify-between text-xs">
        <StrikeMeter label="You" strikes={myStrikes} max={state.max_strikes} highlight={mySeat === state.current_turn} />
        <StrikeMeter
          label="Opponent"
          strikes={opponentStrikes}
          max={state.max_strikes}
          highlight={opponentSeat === state.current_turn}
          align="right"
        />
      </div>

      {/* Chain history */}
      <div className="h-40 w-full overflow-y-auto rounded-xl border border-[var(--lj-border)] bg-white/5 p-3">
        {state.chain.length === 0 ? (
          <p className="text-center text-xs text-[var(--lj-muted)]">
            No words yet - {isMyTurn ? "you go first!" : "waiting for the first word…"}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {state.chain.map((word, i) => (
              <span
                key={i}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  i % 2 === 0 ? "bg-blue-500/15 text-blue-300" : "bg-purple-500/15 text-purple-300"
                }`}
              >
                {word}
              </span>
            ))}
          </div>
        )}
        <div ref={chainEndRef} />
      </div>

      {rejection && (
        <p className="w-full text-center text-xs text-red-400">{rejection}</p>
      )}

      {!state.game_over && (
        <form onSubmit={submitWord} className="flex w-full items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!isMyTurn || submitting}
            placeholder={
              !isMyTurn
                ? "Waiting for opponent…"
                : state.required_letter
                ? `A word starting with "${state.required_letter.toUpperCase()}"…`
                : "Any word to start the chain…"
            }
            maxLength={30}
            className="flex-1 rounded-xl border border-[var(--lj-border)] bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--lj-muted)] focus:border-blue-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!isMyTurn || submitting || !input.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {submitting ? "…" : "Play"}
          </button>
        </form>
      )}

      {state.required_letter && !state.game_over && (
        <p className="text-xs text-[var(--lj-muted)]">
          Next word must start with{" "}
          <span className="font-bold text-white">{state.required_letter.toUpperCase()}</span> · 3 wrong
          words in a row and you lose
        </p>
      )}
    </div>
  );
}

function StrikeMeter({
  label,
  strikes,
  max,
  highlight,
  align = "left",
}: {
  label: string;
  strikes: number;
  max: number;
  highlight: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex flex-col gap-1 ${align === "right" ? "items-end" : "items-start"}`}>
      <span className={`font-semibold ${highlight ? "text-white" : "text-[var(--lj-muted)]"}`}>{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${i < strikes ? "bg-red-500" : "bg-white/15"}`}
          />
        ))}
      </div>
    </div>
  );
}
