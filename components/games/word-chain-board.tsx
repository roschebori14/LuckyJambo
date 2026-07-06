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
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const chainEndRef = useRef<HTMLDivElement>(null);
  // Guards against firing the timeout report every tick once the
  // clock hits zero - only report once per turn, then wait for the
  // resulting state update (new turn_started_at) to re-arm it.
  const reportedTimeoutFor = useRef<string | null>(null);

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

  // Per-turn countdown, ticking locally off the server-stamped
  // turn_started_at so it survives poll/realtime updates without
  // jumping around - this is purely a display; the actual deadline is
  // enforced server-side (applySubmitWord + apply_word_chain_timeout),
  // so there's nothing to gain by tampering with this client's clock.
  useEffect(() => {
    if (!state || state.game_over) {
      setRemainingMs(null);
      return;
    }

    const deadline =
      Date.parse(state.turn_started_at) + state.turn_seconds * 1000;

    const tick = () => setRemainingMs(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state?.turn_started_at, state?.turn_seconds, state?.game_over, state]);

  // Once the countdown for this turn hits zero, tell the server - this
  // fires from *either* player's browser (whoever's tab happens to
  // notice first), which is the point: the player who's stalling can't
  // just avoid reporting themselves out.
  useEffect(() => {
    if (!state || state.game_over) return;
    if (remainingMs === null || remainingMs > 0) return;
    if (reportedTimeoutFor.current === state.turn_started_at) return;

    reportedTimeoutFor.current = state.turn_started_at;
    fetch("/api/word-chain/timeout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: matchId }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.state) setState(json.state);
      })
      .catch(() => {
        /* fetchState's poll/realtime will catch up regardless */
      });
  }, [remainingMs, state, matchId]);

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

  const remainingSeconds =
    remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;
  const totalSeconds = state.turn_seconds;
  const timerFraction =
    remainingMs !== null ? Math.max(0, remainingMs / (totalSeconds * 1000)) : 1;
  const timerUrgent = remainingSeconds !== null && remainingSeconds <= 5;

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

      {/* Turn countdown - ticks down for whoever currently has the
          turn (you or your opponent), so it's clear at a glance there
          IS a clock running even while you're waiting. Once it hits
          zero, either client reports the timeout (see the effect
          above) which costs the stalling player a strike. */}
      {!state.game_over && remainingSeconds !== null && (
        <div className="w-full">
          <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--lj-muted)]">
            <span>{isMyTurn ? "Your time" : "Opponent's time"}</span>
            <span
              className={`font-bold tabular-nums ${timerUrgent ? "text-red-400" : "text-white"}`}
            >
              {remainingSeconds}s
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
                timerUrgent ? "bg-red-500" : isMyTurn ? "bg-blue-400" : "bg-white/30"
              }`}
              style={{ width: `${timerFraction * 100}%` }}
            />
          </div>
        </div>
      )}

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
          <span className="font-bold text-white">{state.required_letter.toUpperCase()}</span> ·{" "}
          {state.turn_seconds}s per turn · 3 wrong words (or timeouts) in a row and you lose
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
