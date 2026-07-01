"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GameOption {
  id: string;
  name: string;
  slug: string;
  min_stake: number;
  max_stake: number;
}

export default function CreateMatchForm({ games }: { games: GameOption[] }) {
  const router = useRouter();
  const [gameSlug, setGameSlug] = useState(games[0]?.slug ?? "");
  const [stakeAmount, setStakeAmount] = useState(String(games[0]?.min_stake ?? ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedGame = games.find((g) => g.slug === gameSlug);

  async function createMatch(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const stake = Number(stakeAmount);
    if (!gameSlug) {
      setError("Choose a game");
      return;
    }
    if (selectedGame && (stake < selectedGame.min_stake || stake > selectedGame.max_stake)) {
      setError(`Stake must be between ${selectedGame.min_stake.toLocaleString()} and ${selectedGame.max_stake.toLocaleString()} XAF`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/matches/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_slug: gameSlug, stake_amount: stake }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message ?? "Could not create match");
        return;
      }

      router.push(`/games/${gameSlug}/match/${json.match.id}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (games.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm text-sm text-gray-500">
        No games are available to play right now.
      </div>
    );
  }

  return (
    <form onSubmit={createMatch} className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Create Match</h2>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Game</label>
        <select
          value={gameSlug}
          onChange={(e) => {
            const g = games.find((g) => g.slug === e.target.value);
            setGameSlug(e.target.value);
            if (g) setStakeAmount(String(g.min_stake));
          }}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          {games.map((g) => (
            <option key={g.slug} value={g.slug}>{g.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Stake Amount (XAF)
        </label>
        <input
          type="number"
          min={selectedGame?.min_stake}
          max={selectedGame?.max_stake}
          value={stakeAmount}
          onChange={(e) => setStakeAmount(e.target.value)}
          placeholder="Stake Amount (XAF)"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        {selectedGame && (
          <p className="mt-1 text-xs text-gray-400">
            {selectedGame.min_stake.toLocaleString()}–{selectedGame.max_stake.toLocaleString()} XAF · winner takes {(Number(stakeAmount || 0) * 2 * 0.95).toLocaleString()} XAF after fee
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create Match"}
      </button>
    </form>
  );
}
