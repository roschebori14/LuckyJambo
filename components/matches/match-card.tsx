"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface MatchCardProps {
  id: string;
  gameName: string;
  gameSlug: string;
  stakeAmount: number;
  status: string;
  creatorName: string;
  isOwn?: boolean;
}

export default function MatchCard({
  id,
  gameName,
  gameSlug,
  stakeAmount,
  status,
  creatorName,
  isOwn = false,
}: MatchCardProps) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

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
      router.push(`/games/${gameSlug}/match/${id}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{gameName}</h3>

        <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
          {status}
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-500">Created by {isOwn ? "you" : creatorName}</p>

      <p className="mt-3 font-medium text-gray-800">Stake: {stakeAmount.toLocaleString()} XAF</p>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <button
        onClick={isOwn ? () => router.push(`/games/${gameSlug}/match/${id}`) : joinMatch}
        disabled={joining}
        className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors disabled:opacity-50 ${
          isOwn ? "bg-gray-500 hover:bg-gray-600" : "bg-green-600 hover:bg-green-700"
        }`}
      >
        {isOwn ? "View Your Match" : joining ? "Joining…" : "Join Match"}
      </button>
    </div>
  );
}
