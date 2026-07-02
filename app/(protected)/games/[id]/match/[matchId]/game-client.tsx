"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";

const ChessBoard = dynamic(() => import("@/components/games/chess-board"), { ssr: false });
const TicTacToeBoard = dynamic(() => import("@/components/games/tic-tac-toe-board"), { ssr: false });
const InstantGameBoard = dynamic(() => import("@/components/games/instant-game-board"), { ssr: false });

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
}

export default function GameClient({ matchId, gameSlug, userId, stakeAmount, initialStatus = "waiting" }: Props) {
  const isInstant = INSTANT_SLUGS.includes(gameSlug as InstantSlug);
  const [status, setStatus] = useState(initialStatus);
  const [copied, setCopied] = useState(false);

  const pollStatus = useCallback(async () => {
    if (status !== "waiting") return;
    
    try {
      const res = await fetch(`/api/matches/status?id=${matchId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status && data.status !== status) {
          setStatus(data.status);
        }
      }
    } catch (e) {
      console.error("Error polling match status", e);
    }
  }, [matchId, status]);

  useEffect(() => {
    if (status === "waiting") {
      const interval = setInterval(pollStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [status, pollStatus]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const copyLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (status === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-white p-8 shadow-sm text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <h3 className="mb-2 text-xl font-bold text-gray-900">Waiting for an opponent...</h3>
        <p className="mb-6 text-sm text-gray-500">
          Share this link with a friend to invite them to play.
        </p>
        <div className="flex w-full max-w-sm items-center gap-2 rounded-lg border bg-gray-50 p-2">
          <input 
            type="text" 
            readOnly 
            value={shareUrl} 
            className="w-full bg-transparent text-sm text-gray-600 outline-none"
          />
          <button 
            onClick={copyLink}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Stake info */}
      <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 border text-sm shadow-sm">
        <span className="text-gray-500">Stake</span>
        <span className="font-bold text-gray-900">{stakeAmount.toLocaleString()} XAF each</span>
        <span className="text-gray-500">Prize</span>
        <span className="font-bold text-green-700">
          {Math.round(stakeAmount * 2 * 0.95).toLocaleString()} XAF
        </span>
      </div>

      {/* Game board */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        {gameSlug === "chess" && <ChessBoard matchId={matchId} userId={userId} />}
        {gameSlug === "tic-tac-toe" && <TicTacToeBoard matchId={matchId} userId={userId} />}
        {isInstant && (
          <InstantGameBoard
            matchId={matchId}
            gameType={INSTANT_TYPE_MAP[gameSlug as InstantSlug]}
          />
        )}
        {gameSlug === "draughts" && (
          <div className="py-10 text-center text-gray-500">
            <p className="text-4xl mb-3">🔴</p>
            <p className="font-semibold">Draughts board UI — Phase 9</p>
            <p className="text-sm text-gray-400 mt-1">Engine is complete, board UI coming next.</p>
          </div>
        )}
      </div>
    </>
  );
}
