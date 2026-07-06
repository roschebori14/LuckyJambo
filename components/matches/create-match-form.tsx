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
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedGame = games.find((g) => g.slug === gameSlug);
  const isLudo = gameSlug === "ludo";

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
      // Ludo has its own creation endpoint (player count, seat/color
      // assignment) - every other game still uses the shared one.
      const endpoint = isLudo ? "/api/ludo/create" : "/api/matches/create";
      const body = isLudo
        ? { stake_amount: stake, max_players: maxPlayers }
        : { game_slug: gameSlug, stake_amount: stake };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      <div className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-6 shadow-sm text-sm text-[var(--lj-muted)]">
        No games are available to play right now.
      </div>
    );
  }

  return (
    <form onSubmit={createMatch} className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-6 shadow-sm space-y-4">
      <h2 className="text-xl font-bold text-white">Create Match</h2>

      {error && <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">Game</label>
        <select
          value={gameSlug}
          onChange={(e) => {
            const g = games.find((g) => g.slug === e.target.value);
            setGameSlug(e.target.value);
            if (g) setStakeAmount(String(g.min_stake));
          }}
          className="lj-input"
        >
          {games.map((g) => (
            <option key={g.slug} value={g.slug}>{g.name}</option>
          ))}
        </select>
      </div>

      {isLudo && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">
            Players
          </label>
          <div className="flex gap-2">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxPlayers(n)}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
                  maxPlayers === n ? "bg-blue-600 text-white" : "bg-white/5 text-[var(--lj-muted)] hover:bg-white/10"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-[var(--lj-muted)]">
            Match starts once all {maxPlayers} seats are filled.
          </p>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">
          Stake Amount (XAF)
        </label>
        <input
          type="number"
          min={selectedGame?.min_stake}
          max={selectedGame?.max_stake}
          value={stakeAmount}
          onChange={(e) => setStakeAmount(e.target.value)}
          placeholder="Stake Amount (XAF)"
          className="lj-input"
        />
        {selectedGame && (
          <p className="mt-1 text-xs text-[var(--lj-muted)]">
            {selectedGame.min_stake.toLocaleString()}–{selectedGame.max_stake.toLocaleString()} XAF · winner takes{" "}
            <span className="lj-stake font-semibold">{(Number(stakeAmount || 0) * (isLudo ? maxPlayers : 2) * 0.95).toLocaleString()} XAF</span> after fee
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="lj-btn-primary w-full py-3 text-sm"
      >
        {loading ? "Creating…" : "Create Match"}
      </button>
    </form>
  );
}
