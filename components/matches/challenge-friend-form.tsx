"use client";

import { useState } from "react";

interface GameOption {
  id: string;
  name: string;
  slug: string;
  min_stake: number;
  max_stake: number;
}

interface FriendOption {
  id: string;
  username: string;
}

export default function ChallengeFriendForm({
  games,
  friends,
}: {
  games: GameOption[];
  friends: FriendOption[];
}) {
  const [friendId, setFriendId] = useState(friends[0]?.id ?? "");
  const [gameSlug, setGameSlug] = useState(games[0]?.slug ?? "");
  const [stakeAmount, setStakeAmount] = useState(String(games[0]?.min_stake ?? ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedGame = games.find((g) => g.slug === gameSlug);
  const selectedFriend = friends.find((f) => f.id === friendId);

  // There's no "invite a specific friend" concept in the schema (matches
  // are open-join, not targeted) - so a challenge is just a normal open
  // match plus a direct link you send your friend so they don't have to
  // hunt for it in the open matches list.
  async function challengeFriend(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const stake = Number(stakeAmount);
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
        setError(json.message ?? "Could not create challenge");
        return;
      }

      const link = `${window.location.origin}/games/${gameSlug}/match/${json.match.id}`;
      setShareLink(link);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (games.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-6 shadow-sm text-sm text-[var(--lj-muted)]">
        No games are available to play right now.
      </div>
    );
  }

  if (shareLink) {
    return (
      <div className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-6 shadow-sm space-y-3">
        <h2 className="text-xl font-bold text-white">Challenge Ready 🎯</h2>
        <p className="text-sm text-[var(--lj-muted)]">
          Send this link to {selectedFriend?.username ?? "your friend"} — the first person to open it and join takes the challenge.
        </p>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--lj-border)] bg-white/5 px-3 py-2">
          <input readOnly value={shareLink} className="flex-1 bg-transparent text-xs text-[var(--lj-text)] outline-none" />
          <button
            onClick={copyLink}
            className="shrink-0 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <button
          onClick={() => setShareLink("")}
          className="text-xs font-semibold text-[var(--lj-muted)] hover:text-[var(--lj-text)]"
        >
          ← Create another challenge
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={challengeFriend} className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-6 shadow-sm space-y-4">
      <h2 className="text-xl font-bold text-white">Challenge a Friend</h2>

      {error && <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">Friend</label>
        {friends.length === 0 ? (
          <p className="rounded-xl bg-white/5 px-4 py-3 text-xs text-[var(--lj-muted)]">
            You don&apos;t have any friends added yet — add some from the Friends page, or just create an open match and share the link with anyone.
          </p>
        ) : (
          <select
            value={friendId}
            onChange={(e) => setFriendId(e.target.value)}
            className="lj-input"
          >
            {friends.map((f) => (
              <option key={f.id} value={f.id}>{f.username}</option>
            ))}
          </select>
        )}
      </div>

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

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">Stake Amount (XAF)</label>
        <input
          type="number"
          min={selectedGame?.min_stake}
          max={selectedGame?.max_stake}
          value={stakeAmount}
          onChange={(e) => setStakeAmount(e.target.value)}
          className="lj-input"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-purple-600 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create Challenge"}
      </button>
    </form>
  );
}
