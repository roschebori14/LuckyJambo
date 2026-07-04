"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";

const ChessBoard = dynamic(() => import("@/components/games/chess-board"), { ssr: false });
const TicTacToeBoard = dynamic(() => import("@/components/games/tic-tac-toe-board"), { ssr: false });
const InstantGameBoard = dynamic(() => import("@/components/games/instant-game-board"), { ssr: false });
const DraughtsBoard = dynamic(() => import("@/components/games/draughts-board"), { ssr: false });
const MatchActions = dynamic(() => import("@/components/games/match-actions"), { ssr: false });

const INSTANT_SLUGS = ["rock_paper_scissors", "coin_flip", "dice"] as const;
type InstantSlug = typeof INSTANT_SLUGS[number];
const INSTANT_TYPE_MAP: Record<InstantSlug, "rock_paper_scissors" | "coin_flip" | "dice_duel"> = {
  rock_paper_scissors: "rock_paper_scissors",
  coin_flip: "coin_flip",
  dice: "dice_duel",
};

interface Props {
  matchId: string;
  gameSlug: string;
  userId: string;
  stakeAmount: number;
  initialStatus?: string;
  isParticipant?: boolean;
}

export default function GameClient({ matchId, gameSlug, userId, stakeAmount, initialStatus = "waiting", isParticipant = true }: Props) {
  const isInstant = INSTANT_SLUGS.includes(gameSlug as InstantSlug);
  const [status, setStatus] = useState(initialStatus);
  const [copied, setCopied] = useState(false);
  const [joined, setJoined] = useState(isParticipant);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const pollStatus = useCallback(async () => {
    if (status !== "waiting") return;
    
    try {
      const res = await fetch(`/api/matches/status?id=${matchId}`);
      if (res.ok) {
        const data = await res.json();
        const nextStatus = data.match?.status;
        if (nextStatus && nextStatus !== status) {
          setStatus(nextStatus);
        }
      }
    } catch (e) {
      console.error("Error polling match status", e);
    }
  }, [matchId, status]);

  useEffect(() => {
    if (status === "waiting" && joined) {
      const interval = setInterval(pollStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [status, joined, pollStatus]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const copyLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  async function joinMatch() {
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
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-8 shadow-sm text-center">
        <h3 className="mb-2 text-xl font-bold text-white">You&apos;ve been challenged!</h3>
        <p className="mb-6 text-sm text-[var(--lj-muted)]">
          Stake {stakeAmount.toLocaleString()} XAF to accept and start the match.
        </p>
        {joinError && (
          <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{joinError}</div>
        )}
        <button
          onClick={joinMatch}
          disabled={joining}
          className="rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {joining ? "Joining…" : "Accept Challenge"}
        </button>
      </div>
    );
  }

  async function cancelMatch() {
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

  if (status === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-8 shadow-sm text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <h3 className="mb-2 text-xl font-bold text-white">Waiting for an opponent...</h3>
        <p className="mb-6 text-sm text-[var(--lj-muted)]">
          Share this link with a friend to invite them to play.
        </p>
        <div className="flex w-full max-w-sm items-center gap-2 rounded-lg border bg-white/5 p-2">
          <input 
            type="text" 
            readOnly 
            value={shareUrl} 
            className="w-full bg-transparent text-sm text-[var(--lj-muted)] outline-none"
          />
          <button 
            onClick={copyLink}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        {cancelError && (
          <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{cancelError}</div>
        )}
        <button
          onClick={cancelMatch}
          disabled={cancelling}
          className="mt-6 rounded-xl border border-red-400/30 px-5 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          {cancelling ? "Cancelling…" : "Cancel Match"}
        </button>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-8 shadow-sm text-center">
        <h3 className="mb-2 text-xl font-bold text-white">Match cancelled</h3>
        <p className="text-sm text-[var(--lj-muted)]">
          Your stake was refunded to your wallet.
        </p>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-8 shadow-sm text-center">
        <h3 className="mb-2 text-xl font-bold text-white">Match ended</h3>
        <p className="text-sm text-[var(--lj-muted)]">
          This match has been settled. Check your wallet or match history for the result.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Stake info */}
      <div className="flex items-center justify-between rounded-xl bg-[var(--lj-card-2)] px-4 py-3 border text-sm shadow-sm">
        <span className="text-[var(--lj-muted)]">Stake</span>
        <span className="font-bold text-white">{stakeAmount.toLocaleString()} XAF each</span>
        <span className="text-[var(--lj-muted)]">Prize</span>
        <span className="font-bold text-green-300">
          {Math.round(stakeAmount * 2 * 0.95).toLocaleString()} XAF
        </span>
      </div>

      {/* Game board */}
      <div className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-5 shadow-sm">
        {gameSlug === "chess" && <ChessBoard matchId={matchId} userId={userId} />}
        {gameSlug === "tic-tac-toe" && <TicTacToeBoard matchId={matchId} userId={userId} />}
        {isInstant && (
          <InstantGameBoard
            matchId={matchId}
            gameType={INSTANT_TYPE_MAP[gameSlug as InstantSlug]}
          />
        )}
        {gameSlug === "draughts" && <DraughtsBoard matchId={matchId} userId={userId} />}
      </div>

      {/* Forfeit / report / resign controls */}
      <div className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-4 shadow-sm">
        <MatchActions matchId={matchId} onMatchEnded={() => setStatus("completed")} hideResign={gameSlug === "chess"} stakeAmount={stakeAmount} />
      </div>
    </>
  );
}
