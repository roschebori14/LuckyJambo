"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";
import { useMatchResultSound } from "@/lib/sound/use-match-result-sound";
import type { WordRushState } from "@/types/word-rush";

interface Props {
  matchId: string;
  userId: string;
}

export default function WordRushBoard({ matchId, userId }: Props) {
  const { play } = useSound();
  const [state, setState] = useState<WordRushState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [input, setInput] = useState("");
  const [rejection, setRejection] = useState("");
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const foundEndRef = useRef<HTMLDivElement>(null);
  // Guards against firing the end-of-round report every tick once the
  // clock hits zero - only report once per round, same idea as
  // word-chain-board's reportedTimeoutFor.
  const reportedEndFor = useRef<string | null>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/word-rush/state?match_id=${matchId}`);
    const json = await res.json();
    if (json.success) setState(json.state);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Live update: the opponent's score ticking up lands instantly
  // instead of waiting up to 3s for the next poll. Their found words
  // are never sent to this client at all (see the API route) - only
  // score numbers change on their side of this payload.
  useMatchRealtime(matchId, (row) => {
    if (row.game_state) setState(row.game_state as WordRushState);
  });

  useEffect(() => {
    foundEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.a_found_words.length, state?.b_found_words.length]);

  // Shared round countdown, ticking locally off the server-stamped
  // round_started_at so it survives poll/realtime updates without
  // jumping around - this is purely a display; the actual deadline is
  // enforced server-side (applySubmitWord + apply_word_rush_end_round),
  // so there's nothing to gain by tampering with this client's clock.
  useEffect(() => {
    if (!state || state.game_over || !state.round_started_at) {
      setRemainingMs(null);
      return;
    }

    const deadline =
      Date.parse(state.round_started_at) + state.round_seconds * 1000;

    const tick = () => setRemainingMs(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state?.round_started_at, state?.round_seconds, state?.game_over, state]);

  // Once the shared countdown hits zero, tell the server - this fires
  // from *either* player's browser, whoever's tab happens to notice
  // first. The server re-derives the real deadline itself, so this is
  // just a nudge to go tally scores, not a trusted "time's up" claim.
  useEffect(() => {
    if (!state || state.game_over || !state.round_started_at) return;
    if (remainingMs === null || remainingMs > 0) return;
    if (reportedEndFor.current === state.round_started_at) return;

    reportedEndFor.current = state.round_started_at;
    fetch("/api/word-rush/end-round", {
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
  const won = !!state && state.winner === mySeat;
  const myScore = mySeat === "A" ? state?.a_score : state?.b_score;
  const opponentScore = mySeat === "A" ? state?.b_score : state?.a_score;
  const myFoundWords = mySeat === "A" ? state?.a_found_words : state?.b_found_words;

  useMatchResultSound(
    state?.game_over
      ? { status: state.winner === null ? "draw" : "resolved", you_won: won }
      : null,
  );

  async function submitWord(e: React.FormEvent) {
    e.preventDefault();
    if (!state || state.game_over || submitting) return;
    const word = input.trim();
    if (!word) return;

    setSubmitting(true);
    setRejection("");
    try {
      const res = await fetch("/api/word-rush/submit-word", {
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
          setRejection(json.reason ?? "That word wasn't accepted");
          // Not clearing the input - a near-miss (typo, wrong letter)
          // is worth letting them edit rather than retype, and a miss
          // costs nothing here so there's no reason to punish it by
          // wiping their attempt.
        }
      } else {
        setRejection(json.message ?? "Submission failed");
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

  const statusText = state.game_over
    ? state.winner === null
      ? "🤝 It's a draw."
      : won
      ? "🏆 You won!"
      : "😔 You lost."
    : state.round_started_at
    ? "Round in progress - find every word you can!"
    : "Waiting for the round to start…";

  const remainingSeconds =
    remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;
  const totalSeconds = state.round_seconds;
  const timerFraction =
    remainingMs !== null ? Math.max(0, remainingMs / (totalSeconds * 1000)) : 1;
  const timerUrgent = remainingSeconds !== null && remainingSeconds <= 10;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Status */}
      <div
        className={`w-full rounded-xl px-4 py-3 text-center text-sm font-semibold ${
          state.game_over
            ? state.winner === null
              ? "bg-white/5 text-[var(--lj-muted)]"
              : won
              ? "bg-green-500/10 text-green-300"
              : "bg-red-500/10 text-red-300"
            : "bg-blue-500/10 text-blue-300"
        }`}
      >
        {statusText}
      </div>

      {/* Shared round countdown - identical for both players since
          it's derived from the same server timestamp. */}
      {!state.game_over && remainingSeconds !== null && (
        <div className="w-full">
          <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--lj-muted)]">
            <span>Time left</span>
            <span
              className={`font-bold tabular-nums ${timerUrgent ? "text-red-400" : "text-white"}`}
            >
              {remainingSeconds}s
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
                timerUrgent ? "bg-red-500" : "bg-blue-400"
              }`}
              style={{ width: `${timerFraction * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Scores - both visible live, but only your own found-words
          list is ever shown (see below) so you can't see what the
          opponent has already claimed. */}
      <div className="flex w-full items-center justify-between text-xs">
        <ScoreBadge label="You" score={myScore ?? 0} />
        <ScoreBadge label="Opponent" score={opponentScore ?? 0} align="right" />
      </div>

      {/* Scramble */}
      <div className="grid w-full grid-cols-7 gap-2 rounded-xl border border-[var(--lj-border)] bg-white/5 p-3">
        {state.letters.map((letter, i) => (
          <div
            key={i}
            className="flex aspect-square items-center justify-center rounded-lg bg-blue-500/15 text-lg font-bold uppercase text-blue-200"
          >
            {letter}
          </div>
        ))}
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
            disabled={submitting || !state.round_started_at}
            placeholder="Type a word from the letters above…"
            maxLength={30}
            className="flex-1 rounded-xl border border-[var(--lj-border)] bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--lj-muted)] focus:border-blue-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={submitting || !input.trim() || !state.round_started_at}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {submitting ? "…" : "Play"}
          </button>
        </form>
      )}

      {/* Your found words - the only found-words list ever rendered
          here. The opponent's live score is visible above, but never
          their words. */}
      <div className="h-32 w-full overflow-y-auto rounded-xl border border-[var(--lj-border)] bg-white/5 p-3">
        {!myFoundWords || myFoundWords.length === 0 ? (
          <p className="text-center text-xs text-[var(--lj-muted)]">
            No words found yet - start typing!
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {myFoundWords.map((word, i) => (
              <span
                key={i}
                className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300"
              >
                {word} · +{scoreLabel(word)}
              </span>
            ))}
          </div>
        )}
        <div ref={foundEndRef} />
      </div>

      <p className="text-xs text-[var(--lj-muted)]">
        3 letters = 100 pts · 4 = 400 · 5 = 800 · 6 = 1400 · +200 per letter after that
      </p>
    </div>
  );
}

// Display-only mirror of engine.ts's scoreForWord, so the found-words
// list can show each word's point value without a round trip - the
// actual score persisted server-side always comes from the real
// engine.ts function, this is purely cosmetic.
function scoreLabel(word: string): number {
  const n = word.length;
  if (n <= 3) return 100;
  if (n === 4) return 400;
  if (n === 5) return 800;
  if (n === 6) return 1400;
  return 1400 + 200 * (n - 6);
}

function ScoreBadge({
  label,
  score,
  align = "left",
}: {
  label: string;
  score: number;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex flex-col gap-1 ${align === "right" ? "items-end" : "items-start"}`}>
      <span className="font-semibold text-[var(--lj-muted)]">{label}</span>
      <span className="text-lg font-bold tabular-nums text-white">{score}</span>
    </div>
  );
}
