"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";

const GAME_IMAGES: Record<string, string> = {
  chess: "/images/games/chess.jpg",
  draughts: "/images/games/draughts.jpg",
  "tic-tac-toe": "/images/games/tic-tac-toe.jpg",
  dice: "/images/games/dice.jpg",
  rock_paper_scissors: "/images/games/rock_paper_scissors.jpg",
  coin_flip: "/images/games/coin_flip.jpg",
};

interface Match {
  id: string;
  stake_amount: number;
  status: string;
  created_at: string;
}

interface GameInfo {
  id: string;
  name: string;
  slug: string;
  min_stake: number;
  max_stake: number;
  description: string | null;
}

export default function GameLobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = use(params);
  const [game, setGame] = useState<GameInfo | null>(null);
  const [openMatches, setOpenMatches] = useState<Match[]>([]);
  const [stake, setStake] = useState<number>(0);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/games/list");
      const json = await res.json();
      const found = json.games?.find((g: GameInfo) => g.slug === slug);
      if (found) {
        setGame(found);
        setStake(found.min_stake);
      }

      const mr = await fetch(`/api/matches/open?slug=${slug}`);
      const mj = await mr.json();
      if (mj.success) setOpenMatches(mj.matches ?? []);
    }
    load();
  }, [slug]);

  async function createMatch() {
    setCreating(true);
    setMessage("");
    try {
      const res = await fetch("/api/matches/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_slug: slug, stake_amount: stake }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage("✅ Match created! Waiting for an opponent…");
        window.location.href = `/games/${slug}/match/${json.match.id}`;
      } else {
        setMessage("❌ " + json.message);
      }
    } finally {
      setCreating(false);
    }
  }

  async function joinMatch(matchId: string) {
    setJoining(matchId);
    setMessage("");
    try {
      const res = await fetch("/api/matches/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });
      const json = await res.json();
      if (json.success) {
        window.location.href = `/games/${slug}/match/${matchId}`;
      } else {
        setMessage("❌ " + json.message);
      }
    } finally {
      setJoining(null);
    }
  }

  if (!game) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back */}
      <Link href="/games" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        ← All Games
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm border">
        <span className="relative flex h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-blue-900">
          <Image src={GAME_IMAGES[slug] ?? "/images/games/dice.jpg"} alt={game.name} fill className="object-cover" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">{game.name}</h1>
          <p className="text-sm text-gray-500">
            Stake {game.min_stake.toLocaleString()}–{game.max_stake.toLocaleString()} XAF
          </p>
        </div>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${message.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message}
        </div>
      )}

      {/* Create match */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-bold text-gray-900">Create a Match</h2>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Your Stake (XAF)
          </label>
          <input
            type="number"
            min={game.min_stake}
            max={game.max_stake}
            step={50}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
          />
          <p className="mt-1 text-xs text-gray-400">
            Winner takes {(stake * 2 * 0.95).toLocaleString()} XAF (after 5% platform fee)
          </p>
        </div>

        <button
          onClick={createMatch}
          disabled={creating || stake < game.min_stake || stake > game.max_stake}
          className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {creating ? "Creating…" : `Create Match — ${stake.toLocaleString()} XAF`}
        </button>
      </div>

      {/* Open matches */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold text-gray-900">
          Open Matches
          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
            {openMatches.length}
          </span>
        </h2>

        {openMatches.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            No open matches yet — create the first one!
          </p>
        ) : (
          <div className="space-y-2">
            {openMatches.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {m.stake_amount.toLocaleString()} XAF stake
                  </p>
                  <p className="text-xs text-gray-400">
                    Pot: {(m.stake_amount * 2 * 0.95).toLocaleString()} XAF net
                  </p>
                </div>
                <button
                  onClick={() => joinMatch(m.id)}
                  disabled={joining === m.id}
                  className="rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {joining === m.id ? "Joining…" : "Join"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
