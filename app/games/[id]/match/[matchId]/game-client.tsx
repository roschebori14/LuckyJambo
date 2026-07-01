"use client";

import dynamic from "next/dynamic";
import MatchActions from "@/components/games/match-actions";
import { GameIcon } from "@/components/games/game-icons";

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
}

export default function GameClient({ matchId, gameSlug, userId, stakeAmount }: Props) {
  const isInstant = INSTANT_SLUGS.includes(gameSlug as InstantSlug);

  return (
    <>
      {/* Stake info */}
      <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 border text-sm">
        <span className="text-gray-500">Stake</span>
        <span className="font-bold text-gray-900">{stakeAmount.toLocaleString()} XAF each</span>
        <span className="text-gray-500">Prize</span>
        <span className="font-bold text-green-700">
          {Math.round(stakeAmount * 2 * 0.95).toLocaleString()} XAF
        </span>
      </div>

      {/* Game board */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "var(--lj-border)", background: "var(--lj-card)" }}>
        {gameSlug === "chess" && <ChessBoard matchId={matchId} userId={userId} />}
        {gameSlug === "tic-tac-toe" && <TicTacToeBoard matchId={matchId} userId={userId} />}
        {isInstant && (
          <InstantGameBoard matchId={matchId} gameType={INSTANT_TYPE_MAP[gameSlug as InstantSlug]} />
        )}
        {gameSlug === "draughts" && (
          <div className="py-10 text-center text-[var(--lj-muted)]">
            <GameIcon slug="draughts" className="mx-auto mb-3 h-10 w-10 text-[var(--lj-muted)]" />
            <p className="font-semibold text-white">Draughts board UI — Phase 9</p>
            <p className="text-sm mt-1">Engine is complete, interactive board coming next.</p>
          </div>
        )}
      </div>

      {/* Dispute / forfeit actions */}
      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--lj-border)", background: "rgba(255,255,255,0.02)" }}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">Match Options</p>
        <MatchActions matchId={matchId} />
      </div>
    </>
  );
}
