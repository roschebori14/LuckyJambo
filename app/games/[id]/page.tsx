"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Swords, Users, Loader2 } from "lucide-react";

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

const GAME_EMOJI: Record<string, string> = {
  chess: "♟️", draughts: "🔴", "tic-tac-toe": "✖️",
  dice: "🎲", rock_paper_scissors: "✊", coin_flip: "🪙",
};

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
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--lj-cyan)" }} />
      </div>
    );
  }

  const netPot = stake * 2 * 0.95;
  const stakeInvalid = stake < game.min_stake || stake > game.max_stake;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Back */}
      <Link href="/games" className="flex items-center gap-1 text-sm text-[var(--lj-muted)] hover:text-white">
        <ArrowLeft size={14} /> All Games
      </Link>

      {/* Header */}
      <div className="relative flex items-center justify-between rounded-2xl bg-white overflow-hidden shadow-sm border border-gray-200">
        <div className="p-6 relative z-10">
          <h1 className="text-3xl font-extrabold text-gray-900 drop-shadow-sm">{game.name}</h1>
          <p className="mt-1 text-sm font-medium text-gray-700 bg-white/60 px-2 py-1 rounded inline-block backdrop-blur-sm">
            Stake {game.min_stake.toLocaleString()}–{game.max_stake.toLocaleString()} XAF
          </p>
        </div>
        <div className="absolute top-0 right-0 h-full w-1/2 md:w-1/3">
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
          <Image 
            src={`/images/${slug}.png`}
            alt={game.name}
            fill
            className="object-cover object-right opacity-90"
            priority
          />
        </div>
      </div>

      {message && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-medium"
          style={
            message.startsWith("✅")
              ? { background: "rgba(0,214,143,0.1)", color: "var(--lj-success)", border: "1px solid rgba(0,214,143,0.25)" }
              : { background: "rgba(255,61,90,0.1)", color: "var(--lj-danger)", border: "1px solid rgba(255,61,90,0.25)" }
          }
        >
          {message}
        </div>
      )}

      {/* Create match */}
      <div className="lj-card space-y-4 p-5">
        <h2 className="font-bold text-white">Create a Match</h2>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">
            Your Stake (XAF)
          </label>
          <input
            type="number"
            min={game.min_stake}
            max={game.max_stake}
            step={50}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="lj-input"
          />
          <p className="mt-1.5 text-xs text-[var(--lj-muted)]">
            Winner takes {netPot.toLocaleString()} XAF (after 5% platform fee)
          </p>
        </div>

        <button
          onClick={createMatch}
          disabled={creating || stakeInvalid}
          className="lj-btn-primary flex w-full items-center justify-center gap-2"
        >
          {creating && <Loader2 size={15} className="animate-spin" />}
          {creating ? "Creating…" : `Create Match — ${stake.toLocaleString()} XAF`}
        </button>
      </div>

      {/* Open matches */}
      <div className="lj-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-white">
          Open Matches
          <span className="lj-badge" style={{ background: "rgba(0,214,143,0.12)", color: "var(--lj-success)" }}>
            {openMatches.length}
          </span>
        </h2>

        {openMatches.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Users size={28} className="text-[var(--lj-muted)]" />
            <p className="text-sm text-[var(--lj-muted)]">No open matches yet — create the first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {openMatches.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--lj-border)" }}
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {m.stake_amount.toLocaleString()} XAF stake
                  </p>
                  <p className="text-xs text-[var(--lj-muted)]">
                    Pot: {(m.stake_amount * 2 * 0.95).toLocaleString()} XAF net
                  </p>
                </div>
                <button
                  onClick={() => joinMatch(m.id)}
                  disabled={joining === m.id}
                  className="lj-btn-primary flex items-center gap-1.5 text-xs"
                  style={{ padding: "8px 16px" }}
                >
                  {joining === m.id && <Loader2 size={12} className="animate-spin" />}
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

