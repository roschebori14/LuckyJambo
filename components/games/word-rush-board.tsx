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

// Shared coordinate space for the letter wheel - viewBox units, not
// pixels, so the SVG scales responsively while every position
// calculation (bubble centers, pointer hit-testing) stays in one
// consistent unit system regardless of the rendered size on screen.
const WHEEL_VIEWBOX = 300;
const WHEEL_CENTER = 150;
const WHEEL_RADIUS = 112;
const BUBBLE_R = 26;

export default function WordRushBoard({ matchId, userId }: Props) {
  const { play } = useSound();
  const [state, setState] = useState<WordRushState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [input, setInput] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [rejection, setRejection] = useState("");
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const foundEndRef = useRef<HTMLDivElement>(null);
  // Guards against firing the end-of-round report every tick once the
  // clock hits zero - only report once per round, same idea as
  // word-chain-board's reportedTimeoutFor.
  const reportedEndFor = useRef<string | null>(null);

  // Letter-wheel drag state. `path` holds letter-array indices (not
  // letters themselves) in selection order, since the same letter can
  // appear as multiple separate bubbles and each needs to be
  // selectable independently. The engine's canFormFromLetters is a
  // plain multiset check with no adjacency requirement, so unlike a
  // true Boggle/Word Hunt board there's no "must be a neighboring
  // bubble" constraint to enforce here - any bubble can follow any
  // other, which keeps the hit-testing simple.
  const [path, setPath] = useState<number[]>([]);
  const [dragging, setDragging] = useState(false);
  const [livePoint, setLivePoint] = useState<{ x: number; y: number } | null>(null);
  const wheelRef = useRef<SVGSVGElement>(null);

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

  async function submitWordValue(rawWord: string) {
    if (!state || state.game_over || submitting) return;
    const word = rawWord.trim();
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

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitWordValue(input);
  }

  // ---------------------------------------------------------------
  // Letter wheel drag handling. All of down/move/up are handled on
  // the SVG root via pointer capture, rather than per-bubble handlers,
  // so a drag that briefly leaves a bubble's exact hitbox (very easy
  // to do on a small phone screen) doesn't drop the gesture - capture
  // keeps every subsequent event routed here regardless of where the
  // pointer physically is.
  // ---------------------------------------------------------------

  function letterCount() {
    return state?.letters.length ?? 0;
  }

  function bubbleCenter(index: number) {
    const total = Math.max(letterCount(), 1);
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
    return {
      x: WHEEL_CENTER + WHEEL_RADIUS * Math.cos(angle),
      y: WHEEL_CENTER + WHEEL_RADIUS * Math.sin(angle),
    };
  }

  // Converts a client-coordinate pointer event into the wheel SVG's
  // own 0-300 viewBox space, so the trailing line lines up with the
  // bubbles regardless of how much the SVG has been scaled down by
  // its responsive container.
  function toViewBoxPoint(clientX: number, clientY: number) {
    const svg = wheelRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * WHEEL_VIEWBOX,
      y: ((clientY - rect.top) / rect.height) * WHEEL_VIEWBOX,
    };
  }

  function indexAtPoint(clientX: number, clientY: number): number | null {
    const el = document.elementFromPoint(clientX, clientY);
    const bubble = el?.closest("[data-letter-index]");
    if (!bubble) return null;
    const idx = Number(bubble.getAttribute("data-letter-index"));
    return Number.isNaN(idx) ? null : idx;
  }

  function handleWheelPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!state || state.game_over || submitting || !state.round_started_at) return;
    const idx = indexAtPoint(e.clientX, e.clientY);
    if (idx === null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setPath([idx]);
    setRejection("");
    const point = toViewBoxPoint(e.clientX, e.clientY);
    if (point) setLivePoint(point);
  }

  function handleWheelPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging) return;
    const point = toViewBoxPoint(e.clientX, e.clientY);
    if (point) setLivePoint(point);

    const idx = indexAtPoint(e.clientX, e.clientY);
    if (idx === null) return;

    setPath((prev) => {
      if (prev.length === 0) return [idx];
      const last = prev[prev.length - 1];
      if (idx === last) return prev;
      // Dragging back over the previous bubble backtracks by one,
      // the standard connect-the-letters convention for correcting a
      // slip without having to release and restart.
      if (prev.length >= 2 && idx === prev[prev.length - 2]) {
        return prev.slice(0, -1);
      }
      if (prev.includes(idx)) return prev;
      return [...prev, idx];
    });
  }

  function handleWheelPointerUp() {
    if (!dragging) return;
    setDragging(false);
    setLivePoint(null);
    if (state && path.length > 0) {
      const word = path.map((i) => state.letters[i]).join("");
      void submitWordValue(word);
    }
    setPath([]);
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (!state) return <p className="text-center text-[var(--lj-muted)]">Failed to load game state.</p>;

  // Defensive: this should be structurally impossible after
  // 068_fix_word_rush_join_race.sql (join_match now refuses to
  // activate a word-rush match before its letters are seeded), but if
  // it ever happens anyway - a still-undiscovered edge case, a match
  // created before that fix, direct DB tampering - showing nothing
  // is the worst possible failure mode: a silent blank box with no
  // way to tell "broken" from "still loading". Surface it plainly
  // instead of letting the wheel render zero bubbles.
  if (!state.game_over && state.round_started_at && state.letters.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="text-sm font-semibold text-red-300">
          This match's letters didn't load correctly.
        </p>
        <p className="text-xs text-[var(--lj-muted)]">
          This is a server-side issue, not something wrong with your
          connection - refreshing won't fix it. Please forfeit this
          match and start a new one; your stake will be handled
          according to the forfeit rules.
        </p>
      </div>
    );
  }


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

      {/* Letter wheel - drag/swipe across bubbles to spell a word,
          release to submit. Any bubble can follow any other (the
          engine has no spatial-adjacency rule, just "can these
          letters spell this word"), so this is closer to a
          connect-the-dots gesture than a true Boggle-style board. */}
      <svg
        ref={wheelRef}
        viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`}
        className="w-full max-w-[320px] touch-none select-none"
        onPointerDown={handleWheelPointerDown}
        onPointerMove={handleWheelPointerMove}
        onPointerUp={handleWheelPointerUp}
        onPointerCancel={handleWheelPointerUp}
      >
        {/* Trail connecting already-selected bubbles, plus one live
            segment out to the current pointer position while
            dragging - this is the part that actually reads as
            "connecting the letters" rather than just highlighting
            them one at a time. */}
        {(path.length > 0 || livePoint) && (
          <polyline
            points={[
              ...path.map((i) => {
                const c = bubbleCenter(i);
                return `${c.x},${c.y}`;
              }),
              ...(livePoint ? [`${livePoint.x},${livePoint.y}`] : []),
            ].join(" ")}
            fill="none"
            stroke="rgba(96,165,250,0.85)"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {state.letters.map((letter, i) => {
          const { x, y } = bubbleCenter(i);
          const selected = path.includes(i);
          return (
            <g key={i} data-letter-index={i}>
              <circle
                cx={x}
                cy={y}
                r={BUBBLE_R}
                fill={selected ? "rgba(37,99,235,0.9)" : "rgba(59,130,246,0.15)"}
                stroke={selected ? "rgba(191,219,254,0.9)" : "rgba(59,130,246,0.35)"}
                strokeWidth={2}
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={22}
                fontWeight={700}
                fill={selected ? "#ffffff" : "#bfdbfe"}
                style={{ textTransform: "uppercase", pointerEvents: "none" }}
              >
                {letter}
              </text>
            </g>
          );
        })}
      </svg>

      {!state.game_over && dragging && path.length > 0 && (
        <p className="text-center text-sm font-bold uppercase tracking-wide text-blue-200">
          {path.map((i) => state.letters[i]).join("")}
        </p>
      )}

      {rejection && (
        <p className="w-full text-center text-xs text-red-400">{rejection}</p>
      )}

      {!state.game_over && (
        <button
          type="button"
          onClick={() => setShowManualEntry((v) => !v)}
          className="text-xs font-medium text-[var(--lj-muted)] underline underline-offset-2"
        >
          {showManualEntry ? "Hide keyboard entry" : "Prefer typing? Enter a word instead"}
        </button>
      )}

      {!state.game_over && showManualEntry && (
        <form onSubmit={handleManualSubmit} className="flex w-full items-center gap-2">
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
