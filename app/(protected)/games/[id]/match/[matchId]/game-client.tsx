"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { RefreshCw, LogOut } from "lucide-react";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useMatchResultSound } from "@/lib/sound/use-match-result-sound";
import { useSound } from "@/lib/sound/sound-manager";
import WaitingForOpponent from "@/components/games/waiting-for-opponent";
import { GameIcon } from "@/components/games/game-icons";

const ChessBoard = dynamic(() => import("@/components/games/chess-board"), {
  ssr: false,
});
const TicTacToeBoard = dynamic(
  () => import("@/components/games/tic-tac-toe-board"),
  { ssr: false },
);
const InstantGameBoard = dynamic(
  () => import("@/components/games/instant-game-board"),
  { ssr: false },
);
const DraughtsBoard = dynamic(
  () => import("@/components/games/draughts-board"),
  { ssr: false },
);
const BattleshipBoard = dynamic(
  () => import("@/components/games/battleship-board"),
  { ssr: false },
);
const SnakesLaddersBoard = dynamic(
  () => import("@/components/games/snakes-ladders-board"),
  { ssr: false },
);
const WordChainBoard = dynamic(
  () => import("@/components/games/word-chain-board"),
  { ssr: false },
);
const FourInARowBoard = dynamic(
  () => import("@/components/games/four-in-a-row-board"),
  { ssr: false },
);
const DotsAndBoxesBoard = dynamic(
  () => import("@/components/games/dots-and-boxes-board"),
  { ssr: false },
);
const MatchActions = dynamic(() => import("@/components/games/match-actions"), {
  ssr: false,
});
const MatchChat = dynamic(() => import("@/components/games/match-chat"), {
  ssr: false,
});

const INSTANT_SLUGS = ["rock_paper_scissors", "coin_flip", "dice"] as const;
type InstantSlug = (typeof INSTANT_SLUGS)[number];
const INSTANT_TYPE_MAP: Record<
  InstantSlug,
  "rock_paper_scissors" | "coin_flip" | "dice_duel"
> = {
  rock_paper_scissors: "rock_paper_scissors",
  coin_flip: "coin_flip",
  dice: "dice_duel",
};

// How long both players get to look at the final board (the winning
// move, checkmate position, last word played, etc.) before the
// full-screen result/rematch overlay replaces it. Without this, the
// board used to vanish the instant `status` flipped to "completed" -
// often mid-animation on the move that actually ended the match.
const RESULT_REVEAL_DELAY_MS = 3000;

interface Props {
  matchId: string;
  gameSlug: string;
  gameName: string;
  userId: string;
  stakeAmount: number;
  initialStatus?: string;
  isParticipant?: boolean;
  isSpectator?: boolean;
  initialWinnerId?: string | null;
  opponentId?: string | null;
  opponentUsername?: string | null;
  createdAt: string;
  invitedUsername?: string | null;
}

export default function GameClient({
  matchId,
  gameSlug,
  gameName,
  userId,
  stakeAmount,
  initialStatus = "waiting",
  isParticipant = true,
  isSpectator = false,
  initialWinnerId = null,
  opponentId = null,
  opponentUsername = null,
  createdAt,
  invitedUsername = null,
}: Props) {
  const router = useRouter();
  const { play } = useSound();
  const isInstant = INSTANT_SLUGS.includes(gameSlug as InstantSlug);
  const [status, setStatus] = useState(initialStatus);
  // `status` is the raw, immediate truth (used for polling/realtime
  // bookkeeping below). `displayStatus` is what the UI actually
  // branches on - it tracks `status` instantly for every transition
  // except into "completed", which it holds off on for
  // RESULT_REVEAL_DELAY_MS so the board underneath stays visible for a
  // beat first. Both players get this delay since both read it off the
  // same status/realtime feed, not off whichever client happened to
  // make the final move.
  const [displayStatus, setDisplayStatus] = useState(initialStatus);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [winnerId, setWinnerId] = useState(initialWinnerId);
  const [copied, setCopied] = useState(false);
  // A spectator is never "joined" (they have no participant row and
  // never will), but they also shouldn't hit the "Accept Challenge"
  // gate below - that's only for a real prospective player. Treating
  // `joined` as true for spectators skips straight past that gate to
  // the read-only board render further down.
  const [joined, setJoined] = useState(isParticipant || isSpectator);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [rematching, setRematching] = useState(false);
  const [rematchError, setRematchError] = useState("");

  const pollStatus = useCallback(async () => {
    // Only stop polling once the match has reached a genuinely
    // terminal state - "waiting" and "active" both still need
    // watching. This used to bail out for anything other than
    // "waiting", which meant that once a match went active, this
    // fallback poll stopped entirely and useMatchRealtime below was
    // the only thing left checking. If a realtime event was ever
    // missed (tab backgrounded, brief reconnect, dropped message), a
    // forfeit/resign/withdraw by the other player would never show up
    // here until the page was manually reloaded.
    if (status === "completed" || status === "cancelled") return;

    try {
      const res = await fetch(`/api/matches/status?id=${matchId}`);
      if (res.ok) {
        const data = await res.json();
        const nextStatus = data.match?.status;
        if (nextStatus && nextStatus !== status) {
          setStatus(nextStatus);
        }
        if ("winner_id" in (data.match ?? {})) {
          setWinnerId(data.match.winner_id ?? null);
        }
      }
    } catch (e) {
      console.error("Error polling match status", e);
    }
  }, [matchId, status]);

  useEffect(() => {
    // Same fix mirrored here: keep the interval alive through
    // "active", not just "waiting". useMatchRealtime is still the
    // fast path for an instant update; this poll is the reliable
    // fallback that guarantees the other player finds out within one
    // interval even if a realtime event never arrives.
    if (joined && status !== "completed" && status !== "cancelled") {
      const interval = setInterval(pollStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [status, joined, pollStatus]);

  // Live update: the instant the opponent joins, cancels, or the match
  // otherwise changes status, react immediately instead of waiting for
  // the next 3s poll. The poll above stays as a fallback.
  useMatchRealtime(matchId, (row) => {
    const nextStatus = row.status as string | undefined;
    if (nextStatus) {
      setStatus((prev) => (nextStatus !== prev ? nextStatus : prev));
    }
    if ("winner_id" in row) {
      setWinnerId(row.winner_id as string | null);
    }
  });

  // Drive displayStatus off status: instant for everything except the
  // "-> completed" transition, which is held back a few seconds. If
  // status somehow flips away from completed (shouldn't happen, but if
  // it did) or arrives already completed on first load (page refresh
  // after the fact), there's no board-reveal moment to protect, so show
  // it immediately - the delay only matters for a transition witnessed
  // live.
  useEffect(() => {
    if (status === "completed" && displayStatus !== "completed") {
      revealTimerRef.current = setTimeout(
        () => setDisplayStatus("completed"),
        RESULT_REVEAL_DELAY_MS,
      );
      return () => {
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      };
    }
    if (status !== "completed") {
      setDisplayStatus(status);
    }
  }, [status, displayStatus]);

  useEffect(() => () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
  }, []);

  // Board-specific components (chess/tic-tac-toe/draughts/battleship/
  // snakes-ladders) each track their own local win/lose text, but none
  // of them ever fired a sound - only the separate "instant game"
  // board (rock-paper-scissors/coin-flip/dice) had useMatchResultSound
  // wired up. `status` + `winnerId` here are already the single
  // source of truth shared by every game type, so hook the sound in
  // once at this level instead of duplicating it into five board
  // components. A spectator has no personal result, so no sound fires
  // for them.
  const matchResult = useMemo(() => {
    if (displayStatus !== "completed" || isSpectator) return null;
    return {
      status: winnerId == null ? "draw" : ("completed" as const),
      you_won: winnerId === userId,
    };
  }, [displayStatus, winnerId, userId, isSpectator]);

  useMatchResultSound(matchResult);

  // "match-found" is defined in the sound catalog but nothing ever
  // triggered it - wire it here for the same reason win/lose/draw
  // live at this level: `status` here is the single source of truth
  // for every game type, fed by both the realtime handler above and
  // the poll fallback, regardless of which one actually catches the
  // transition first. A ref (not state) tracks the previous value so
  // this fires exactly once on the real waiting->active transition,
  // not on every render or on a page load that already starts active.
  const prevStatusRef = useRef(initialStatus);
  useEffect(() => {
    if (prevStatusRef.current === "waiting" && status === "active" && !isSpectator) {
      play("match-found");
    }
    prevStatusRef.current = status;
  }, [status, isSpectator, play]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const copyLink = async () => {
    play("button-tap");
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  async function joinMatch() {
    play("button-tap");
    setJoining(true);
    setJoinError("");
    try {
      const res = await fetch("/api/matches/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });
      const json = await res.json();
      if (!json.success) {
        setJoinError(json.message ?? "Could not join match");
        return;
      }
      setJoined(true);
      setStatus("active");
    } catch {
      setJoinError("Network error — please try again.");
    } finally {
      setJoining(false);
    }
  }

  // Anyone opening this page who isn't a participant yet (e.g. a
  // friend clicking a direct-challenge share link) needs to actually
  // join before anything else happens - just watching the page never
  // calls /api/matches/join on its own.
  if (!joined) {
    const potentialPrize = Math.round(stakeAmount * 2 * 0.95);
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] shadow-sm">
        <div className="flex flex-col items-center gap-4 px-6 pb-8 pt-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full shadow-lg"
            style={{ background: "linear-gradient(135deg, var(--lj-blue) 0%, var(--lj-cyan) 100%)" }}>
            <GameIcon slug={gameSlug} className="h-9 w-9 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">You&apos;ve been challenged!</h3>
            <p className="mt-1 text-sm text-[var(--lj-muted)]">{gameName}</p>
          </div>

          <div className="flex w-full max-w-xs items-center justify-between rounded-xl px-4 py-2.5 text-sm"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--lj-border)" }}>
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-wide text-[var(--lj-muted)]">Stake to accept</p>
              <p className="font-bold text-white">{stakeAmount.toLocaleString()} XAF</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-[var(--lj-muted)]">Winner takes</p>
              <p className="font-bold text-green-400">{potentialPrize.toLocaleString()} XAF</p>
            </div>
          </div>

          {joinError && (
            <div className="w-full rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {joinError}
            </div>
          )}

          <button
            onClick={joinMatch}
            disabled={joining}
            className="rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {joining ? "Joining…" : "Accept Challenge"}
          </button>
        </div>
      </div>
    );
  }

  async function cancelMatch() {
    play("button-tap");
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch("/api/matches/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });
      const json = await res.json();
      if (!json.success) {
        setCancelError(json.message ?? "Could not cancel match");
        return;
      }
      setStatus("cancelled");
    } catch {
      setCancelError("Network error — please try again.");
    } finally {
      setCancelling(false);
    }
  }

  if (displayStatus === "waiting") {
    return (
      <WaitingForOpponent
        gameSlug={gameSlug}
        gameName={gameName}
        stakeAmount={stakeAmount}
        createdAt={createdAt}
        shareUrl={shareUrl}
        copied={copied}
        onCopy={copyLink}
        cancelling={cancelling}
        cancelError={cancelError}
        onCancel={cancelMatch}
        invitedUsername={invitedUsername}
      />
    );
  }

  if (displayStatus === "cancelled") {
    // cancel_match (creator backing out of an open match) only ever
    // works while status is still "waiting" - i.e. before anyone else
    // has joined. So if this match reached "cancelled" status AND has
    // a known opponent, it can only have gotten here through
    // refund_draw (a real draw both players finished), not a
    // pre-match cancellation - worth a different message and a
    // rematch option, same as a decisive finish.
    if (opponentId) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-8 shadow-sm text-center">
          <h3 className="mb-2 text-2xl font-black text-yellow-300">
            🤝 It&apos;s a draw!
          </h3>
          <p className="mb-6 text-sm text-[var(--lj-muted)]">
            Your stake was refunded to your wallet.
          </p>
          {rematchError && (
            <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {rematchError}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={playRematch}
              disabled={rematching}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={rematching ? "animate-spin" : ""}
              />
              {rematching
                ? "Setting up…"
                : opponentUsername
                  ? `Rematch ${opponentUsername}`
                  : "Rematch"}
            </button>
            <Link
              href="/games"
              className="flex items-center gap-2 rounded-xl border border-[var(--lj-border)] px-6 py-3 text-sm font-semibold text-[var(--lj-muted)] hover:bg-white/5"
            >
              <LogOut size={16} /> Quit
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-8 shadow-sm text-center">
        <h3 className="mb-2 text-xl font-bold text-white">Match cancelled</h3>
        <p className="mb-6 text-sm text-[var(--lj-muted)]">
          Your stake was refunded to your wallet.
        </p>
        <Link
          href="/games"
          className="flex items-center gap-2 rounded-xl border border-[var(--lj-border)] px-6 py-3 text-sm font-semibold text-[var(--lj-muted)] hover:bg-white/5"
        >
          <LogOut size={16} /> Back to Games
        </Link>
      </div>
    );
  }

  async function playRematch() {
    play("button-tap");
    setRematching(true);
    setRematchError("");
    try {
      const res = await fetch("/api/matches/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_slug: gameSlug,
          stake_amount: stakeAmount,
          invited_user_id: opponentId ?? undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setRematchError(json.message ?? "Could not create rematch");
        return;
      }
      router.push(`/games/${gameSlug}/match/${json.match.id}`);
    } catch {
      setRematchError("Network error — please try again.");
    } finally {
      setRematching(false);
    }
  }

  if (displayStatus === "completed") {
    // A spectator has no stake or personal result in this match - the
    // won/lost framing and Rematch action below are meaningless (and
    // opponentId is always null for them anyway, since that field is
    // relative to "the other player from *my* seat"). Show a plain,
    // neutral result instead.
    if (isSpectator) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-8 shadow-sm text-center">
          <h3 className="mb-2 text-2xl font-black text-[var(--lj-muted)]">Match settled</h3>
          <p className="mb-6 text-sm text-[var(--lj-muted)]">This match has finished.</p>
          <Link
            href="/matches"
            className="flex items-center gap-2 rounded-xl border border-[var(--lj-border)] px-6 py-3 text-sm font-semibold text-[var(--lj-muted)] hover:bg-white/5"
          >
            <LogOut size={16} /> Back to Matches
          </Link>
        </div>
      );
    }

    const won = winnerId != null && winnerId === userId;
    const lost = winnerId != null && winnerId !== userId;
    const resultText = won
      ? "🏆 You won!"
      : lost
        ? "😔 You lost"
        : "Match settled";
    const resultColor = won
      ? "text-green-300"
      : lost
        ? "text-red-300"
        : "text-[var(--lj-muted)]";

    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-8 shadow-sm text-center">
        <h3 className={`mb-2 text-2xl font-black ${resultColor}`}>
          {resultText}
        </h3>
        <p className="mb-6 text-sm text-[var(--lj-muted)]">
          This match has been settled. Check your wallet or match history for
          the payout details.
        </p>

        {rematchError && (
          <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {rematchError}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={playRematch}
            disabled={rematching || !opponentId}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <RefreshCw size={16} className={rematching ? "animate-spin" : ""} />
            {rematching
              ? "Setting up…"
              : opponentUsername
                ? `Rematch ${opponentUsername}`
                : "Rematch"}
          </button>
          <Link
            href="/games"
            className="flex items-center gap-2 rounded-xl border border-[var(--lj-border)] px-6 py-3 text-sm font-semibold text-[var(--lj-muted)] hover:bg-white/5"
          >
            <LogOut size={16} /> Quit
          </Link>
        </div>

        {!opponentId && (
          <p className="mt-4 text-xs text-[var(--lj-muted)]">
            Rematch isn&apos;t available without a known opponent - head back to
            Games to start a new match.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Stake info - meaningless to a spectator, who has no stake in
          this match */}
      {!isSpectator && (
        <div className="flex items-center justify-between rounded-xl bg-[var(--lj-card-2)] px-4 py-3 border text-sm shadow-sm">
          <span className="text-[var(--lj-muted)]">Stake</span>
          <span className="font-bold text-white">
            {stakeAmount.toLocaleString()} XAF each
          </span>
          <span className="text-[var(--lj-muted)]">Prize</span>
          <span className="font-bold text-green-300">
            {Math.round(stakeAmount * 2 * 0.95).toLocaleString()} XAF
          </span>
        </div>
      )}

      {/* Game board - spectators get the same live board (it's driven
          by the same match_id and realtime channel as the players see),
          just visually locked so clicks can't attempt a move. The move
          APIs already reject non-participants server-side regardless -
          this is purely so a spectator isn't left guessing why nothing
          happens when they click a cell. */}
      <div
        className="relative rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-5 shadow-sm"
        style={isSpectator ? { pointerEvents: "none" } : undefined}
      >
        {isSpectator && (
          <span className="absolute right-3 top-3 z-10 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            👀 Spectating
          </span>
        )}
        {gameSlug === "chess" && (
          <ChessBoard matchId={matchId} userId={userId} />
        )}
        {gameSlug === "tic-tac-toe" && (
          <TicTacToeBoard matchId={matchId} userId={userId} />
        )}
        {isInstant && (
          <InstantGameBoard
            matchId={matchId}
            gameType={INSTANT_TYPE_MAP[gameSlug as InstantSlug]}
          />
        )}
        {gameSlug === "draughts" && (
          <DraughtsBoard matchId={matchId} userId={userId} />
        )}
        {gameSlug === "battleship" && (
          <BattleshipBoard matchId={matchId} userId={userId} />
        )}
        {gameSlug === "snakes-ladders" && (
          <SnakesLaddersBoard matchId={matchId} userId={userId} />
        )}
        {gameSlug === "four-in-a-row" && (
          <FourInARowBoard matchId={matchId} userId={userId} />
        )}
        {gameSlug === "dots-and-boxes" && (
          <DotsAndBoxesBoard matchId={matchId} userId={userId} />
        )}
        {gameSlug === "word-chain" && (
          <WordChainBoard matchId={matchId} userId={userId} />
        )}
      </div>

      {/* Quick chat + forfeit/report/resign controls only make sense
          for the two actual players. */}
      {!isSpectator && (
        <>
          <MatchChat matchId={matchId} userId={userId} opponentUsername={opponentUsername} />

          <div className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-4 shadow-sm">
            <MatchActions
              matchId={matchId}
              onMatchEnded={async () => {
                setStatus("completed");
                try {
                  const res = await fetch(`/api/matches/status?id=${matchId}`);
                  const json = await res.json();
                  if (json.success) setWinnerId(json.match?.winner_id ?? null);
                } catch {
                  /* realtime will pick this up shortly regardless */
                }
              }}
              hideResign={gameSlug === "chess"}
              stakeAmount={stakeAmount}
            />
          </div>
        </>
      )}
    </>
  );
}
