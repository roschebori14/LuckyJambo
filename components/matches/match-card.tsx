"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, PlayCircle } from "lucide-react";

interface MatchCardProps {
  id: string;
  gameName: string;
  gameSlug: string;
  stakeAmount: number;
  status: string;
  creatorName: string;
  isOwn?: boolean;
  /** True if the current user is one of this match's two players
   *  (creator or joined opponent). Only meaningful for 'active'
   *  matches - 'waiting' matches use `isOwn` instead, since nobody
   *  else can be a participant yet. */
  isParticipant?: boolean;
}

export default function MatchCard({
  id,
  gameName,
  gameSlug,
  stakeAmount,
  status,
  creatorName,
  isOwn = false,
  isParticipant = false,
}: MatchCardProps) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const href = `/games/${gameSlug}/match/${id}`;
  const mine = isOwn || isParticipant;

  async function joinMatch() {
    setJoining(true);
    setError("");
    try {
      const res = await fetch("/api/matches/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: id }),
      });
      const json = await res.json();
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
    <div className="rounded-xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{gameName}</h3>

        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${
          status === "active" ? "bg-green-500/15 text-green-400" : "bg-blue-100 text-blue-300"
        }`}>
          {status === "active" && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
            </span>
          )}
          {status}
        </span>
      </div>

      <p className="mt-2 text-sm text-[var(--lj-muted)]">
        Created by{" "}
        {isOwn ? (
          "you"
        ) : (
          <Link href={`/profile/${creatorName}`} className="hover:underline">
            {creatorName}
          </Link>
        )}
      </p>

      <p className="mt-3 font-medium text-white">Stake: {stakeAmount.toLocaleString()} XAF</p>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {status === "active" ? (
        <button
          onClick={() => router.push(href)}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors ${
            mine ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700"
          }`}
        >
          {mine ? <PlayCircle size={16} /> : <Eye size={16} />}
          {mine ? "Resume Match" : "Spectate"}
        </button>
      ) : (
        <button
          onClick={isOwn ? () => router.push(href) : joinMatch}
          disabled={joining}
          className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors disabled:opacity-50 ${
            isOwn ? "bg-gray-500 hover:bg-gray-600" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isOwn ? "View Your Match" : joining ? "Joining…" : "Join Match"}
        </button>
      )}
    </div>
  );
}
