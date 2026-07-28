"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, PlayCircle, Coins, Users, Zap } from "lucide-react";
import { GameIcon } from "@/components/games/game-icons";
import { getGameMeta } from "@/components/games/game-meta";
import { timeAgo } from "@/lib/utils/time-ago";
import { joinMatchRequest } from "@/lib/matchmaking/join-match";

interface MatchCardProps {
  id: string;
  gameName: string;
  gameSlug: string;
  stakeAmount: number;
  status: string;
  creatorName: string;
  timestamp?: string;
  isOwn?: boolean;
  /** Defaults to 2 (every game except Ludo is exactly 2 players).
   *  Ludo can be 2-4 - the pot math below multiplies by this instead
   *  of a hardcoded *2, which previously undercounted 3-4 player Ludo
   *  pots. */
  maxPlayers?: number;
  /** True if the current user is one of this match's two players
   *  (creator or joined opponent). Only meaningful for 'active'
   *  matches - 'waiting' matches use `isOwn` instead, since nobody
   *  else can be a participant yet. */
  isParticipant?: boolean;
  /** This card just streamed in via realtime this session - see
   *  MatchesLobbyLive/MatchList. Triggers the one-time gold arrival
   *  glow (.lj-match-card-new, app/globals.css) and a "Just now" pill. */
  isNew?: boolean;
}

export default function MatchCard({
  id,
  gameName,
  gameSlug,
  stakeAmount,
  status,
  creatorName,
  timestamp,
  isOwn = false,
  isParticipant = false,
  isNew = false,
  maxPlayers = 2,
}: MatchCardProps) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const href = `/games/${gameSlug}/match/${id}`;
  const mine = isOwn || isParticipant;
  const isActive = status === "active";
  const meta = getGameMeta(gameSlug);
  const potAmount = isActive ? stakeAmount * maxPlayers : Math.round(stakeAmount * maxPlayers * 0.95);

  async function joinMatch() {
    setJoining(true);
    setError("");
    try {
      const endpoint = gameSlug === "ludo" ? "/api/ludo/join" : "/api/matches/join";
      const json = await joinMatchRequest(endpoint, id);
      if (!json.success) {
        setError(json.message ?? "Could not join match");
        return;
      }
      router.push(href);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className={`lj-match-card p-5 ${isNew ? "lj-match-card-new" : ""}`}>
      {/* Header: per-game icon tile + name + live/open status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
            <GameIcon slug={gameSlug.trim().toLowerCase()} className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-white">{gameName}</h3>
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--lj-muted)]">
              {meta.type === "Instant" ? <Zap size={9} /> : <Users size={9} />}
              {meta.type}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
              isActive ? "bg-green-500/15 text-green-400" : "bg-blue-500/15 text-blue-300"
            }`}
          >
            {isActive && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
              </span>
            )}
            {isActive ? "LIVE" : "OPEN"}
          </span>
          {isNew && (
            <span className="rounded-full bg-[var(--lj-gold)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--lj-gold)]">
              Just now
            </span>
          )}
        </div>
      </div>

      {/* Stake / pot */}
      <div className="mt-4 flex items-end justify-between rounded-xl bg-white/[0.03] px-3.5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--lj-muted)]">
            {isActive ? "Pot" : "Stake"}
          </p>
          <p className="lj-stake flex items-center gap-1.5 text-lg font-extrabold">
            <Coins size={15} />
            {stakeAmount.toLocaleString()} <span className="text-xs font-semibold text-[var(--lj-muted)]">XAF</span>
          </p>
        </div>
        {!isActive && (
          <p className="text-right text-[11px] text-[var(--lj-muted)]">
            Winner takes<br />
            <span className="font-bold text-[var(--lj-text)]">{potAmount.toLocaleString()} XAF</span>
          </p>
        )}
      </div>

      {/* Creator + freshness */}
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--lj-muted)]">
        <span>
          {isOwn ? (
            "Created by you"
          ) : (
            <>
              by{" "}
              <Link href={`/profile/${creatorName}`} className="font-medium text-[var(--lj-text)] hover:underline">
                {creatorName}
              </Link>
            </>
          )}
        </span>
        {timestamp && <span>{timeAgo(timestamp)}</span>}
      </div>

      {error && <p className="mt-2 text-xs text-[var(--lj-danger)]">{error}</p>}

      {isActive ? (
        <button
          onClick={() => router.push(href)}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
            mine
              ? "lj-btn-primary"
              : "border border-[var(--lj-border)] bg-white/5 text-[var(--lj-text)] hover:bg-white/10"
          }`}
        >
          {mine ? <PlayCircle size={16} /> : <Eye size={16} />}
          {mine ? "Resume Match" : "Spectate"}
        </button>
      ) : (
        <button
          onClick={isOwn ? () => router.push(href) : joinMatch}
          disabled={joining}
          className={`mt-4 w-full rounded-xl py-2.5 text-sm font-bold transition-all disabled:opacity-50 ${
            isOwn
              ? "border border-[var(--lj-border)] bg-white/5 text-[var(--lj-text)] hover:bg-white/10"
              : "lj-btn-primary"
          }`}
        >
          {isOwn ? "View Your Match" : joining ? "Joining…" : "Join Match"}
        </button>
      )}
    </div>
  );
}
