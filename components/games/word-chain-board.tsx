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
  const reportedTimeoutFor = useRef<string | null>(null);
  const timeoutRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockOffsetRef = useRef(0);
  const prevStrikesRef = useRef<{ a: number; b: number } | null>(null);
  const prevTurnStartedRef = useRef<string | null>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/word-chain/state?match_id=${matchId}`);
    const json = await res.json();
    if (json.success) {
      if (json.server_time) {
        clockOffsetRef.current = Date.parse(json.server_time) - Date.now();
      }
      setState(json.state);
    }
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  useMatchRealtime(matchId, (row) => {
    if (row.game_state) setState(row.game_state as WordChainState);
  });

  // Re-sync when the tab comes back into focus (mobile browsers throttle timers).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") fetchState();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchState]);

  useEffect(() => {
    chainEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.chain.length]);

  // Per-turn countdown synced to server clock via clockOffsetRef.
  useEffect(() => {
    if (!state || state.game_over) {
      setRemainingMs(null);
      return;
    }

    const deadline =
      Date.parse(state.turn_started_at) +
      state.turn_seconds * 1000 -
      clockOffsetRef.current;

    const tick = () =>
      setRemainingMs(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state?.turn_started_at, state?.turn_seconds, state?.game_over, state]);

  const reportTimeout = useCallback(async () => {
    if (!state || state.game_over) return;

    try {
      const res = await fetch("/api/word-chain/timeout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });
      const json = await res.json();
      if (json.success && json.state) {
        reportedTimeoutFor.current = state.turn_started_at;
        setState(json.state);
      } else if (remainingMs !== null && remainingMs <= 0) {
        // Server clock may lag — retry until it agrees or turn changes.
        timeoutRetryRef.current = setTimeout(reportTimeout, 1500);
      }
    } catch {
      timeoutRetryRef.current = setTimeout(reportTimeout, 2000);
    }
  }, [state, matchId, remainingMs]);

  useEffect(() => {
    if (!state || state.game_over) return;
    if (remainingMs === null || remainingMs > 0) return;
    if (reportedTimeoutFor.current === state.turn_started_at) return;

    reportTimeout();
    return () => {
      if (timeoutRetryRef.current) clearTimeout(timeoutRetryRef.current);
    };
  }, [remainingMs, state, reportTimeout]);

  const prevChainLenRef = useRef(0);
  const prevSecondsRef = useRef<number | null>(null);

  // Detect timeout strikes landing via realtime/poll and give feedback.
  useEffect(() => {
    if (!state) return;

    const prev = prevStrikesRef.current;
    const prevLen = prevChainLenRef.current;
    const turnChanged = prevTurnStartedRef.current !== null &&
      prevTurnStartedRef.current !== state.turn_started_at;
    const chainUnchanged = state.chain.length === prevLen;

    if (
      prev &&
      turnChanged &&
      chainUnchanged &&
      (state.strikes_a > prev.a || state.strikes_b > prev.b)
    ) {
      const mySeat = state.a_player_id === userId ? "A" : "B";
      const myStrikeIncreased =
        (mySeat === "A" && state.strikes_a > prev.a) ||
        (mySeat === "B" && state.strikes_b > prev.b);

      if (myStrikeIncreased && isMyTurnSeat(state, mySeat)) {
        play("word-rejected");
        setRejection("Time's up — that's a strike!");
      }
    }

    prevStrikesRef.current = { a: state.strikes_a, b: state.strikes_b };
    prevTurnStartedRef.current = state.turn_started_at;
    prevChainLenRef.current = state.chain.length;
  }, [state, userId, play]);

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
        if (json.timed_out) {
          play("word-rejected");
          setRejection(json.reason ?? "Time's up — strike added!");
        } else if (json.word_accepted) {
          play("move");
          setInput("");
        } else {
          play("word-rejected");
          setRejection(json.reason ?? "That word wasn't accepted");
        }
      } else {
        setRejection(json.message ?? "Move failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const remainingSeconds =
    remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;

  // Tick sound in the final 5 seconds on your turn.
  useEffect(() => {
    if (
      remainingSeconds !== null &&
      remainingSeconds <= 5 &&
      remainingSeconds > 0 &&
      isMyTurn &&
      !state?.game_over &&
      prevSecondsRef.current !== remainingSeconds
    ) {
      play("button-tap");
    }
    prevSecondsRef.current = remainingSeconds;
  }, [remainingSeconds, isMyTurn, state?.game_over, play]);

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
  const lastWord = state.chain.length > 0 ? state.chain[state.chain.length - 1] : null;

  const statusText = state.game_over
    ? won
      ? "🏆 You won!"
      : "😔 You lost."
    : isMyTurn
    ? "Your turn"
    : "Waiting for opponent…";

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

      {/* Required letter — prominent when chain has started */}
      {!state.game_over && state.required_letter && (
        <div className="flex w-full items-center justify-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
          <span className="text-xs text-indigo-300/80">Next word starts with</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-900/40">
            {state.required_letter.toUpperCase()}
          </span>
          {lastWord && (
            <span className="text-xs text-indigo-300/60">
              after{" "}
              <span className="font-semibold text-indigo-200">
                {lastWord.slice(0, -1)}
                <span className="text-yellow-300">{lastWord.slice(-1)}</span>
              </span>
            </span>
          )}
        </div>
      )}

      {/* Turn countdown */}
      {!state.game_over && remainingSeconds !== null && (
        <div className="w-full">
          <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--lj-muted)]">
            <span>{isMyTurn ? "Your time" : "Opponent's time"}</span>
            <span
              className={`font-bold tabular-nums ${timerUrgent ? "text-red-400 animate-pulse" : "text-white"}`}
            >
              {remainingSeconds}s
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
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
        <div className="text-center text-[10px] text-[var(--lj-muted)]">
          {state.chain.length} word{state.chain.length !== 1 ? "s" : ""}
        </div>
        <StrikeMeter
          label="Opponent"
          strikes={opponentStrikes}
          max={state.max_strikes}
          highlight={opponentSeat === state.current_turn}
          align="right"
        />
      </div>

      {/* Chain history */}
      <div className="h-44 w-full overflow-y-auto rounded-xl border border-[var(--lj-border)] bg-white/5 p-3">
        {state.chain.length === 0 ? (
          <p className="text-center text-xs text-[var(--lj-muted)]">
            No words yet — {isMyTurn ? "you go first!" : "waiting for the first word…"}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {state.chain.map((word, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span className="text-[10px] text-[var(--lj-muted)]">→</span>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    i % 2 === 0 ? "bg-blue-500/15 text-blue-300" : "bg-purple-500/15 text-purple-300"
                  }`}
                >
                  {word.slice(0, -1)}
                  <span className="text-yellow-300">{word.slice(-1)}</span>
                </span>
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
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
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

      {!state.game_over && (
        <p className="text-xs text-[var(--lj-muted)]">
          {state.turn_seconds}s per turn · 3 strikes (wrong words or timeouts) and you lose
        </p>
      )}
    </div>
  );
}

function isMyTurnSeat(state: WordChainState, seat: "A" | "B") {
  return state.current_turn === seat && !state.game_over;
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
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              i < strikes ? "bg-red-500" : "bg-white/15"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
