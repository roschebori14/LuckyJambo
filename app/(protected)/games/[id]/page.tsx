"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { Gamepad2 } from "lucide-react";
import { useMatchesLobbyRealtime } from "@/hooks/use-matches-lobby-realtime";

interface Match {
  id: string;
  stake_amount: number;
  max_players?: number;
  status: string;
  created_at: string;
  creator?: { username: string; avatar_url: string | null } | null;
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
  chess: "♟️",
  draughts: "🔴",
  "tic-tac-toe": "✖️",
  dice: "🎲",
  rock_paper_scissors: "✊",
  coin_flip: "🪙",
};

export default function GameLobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: slug } = use(params);
  const [game, setGame] = useState<GameInfo | null>(null);
  const [openMatches, setOpenMatches] = useState<Match[]>([]);
  const [stake, setStake] = useState<number>(0);
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(4);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [imgFailed, setImgFailed] = useState(false);

  const refreshOpenMatches = useCallback(async () => {
    const mr = await fetch(`/api/matches/open?slug=${slug}`);
    const mj = await mr.json();
    if (mj.success) setOpenMatches(mj.matches ?? []);
  }, [slug]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/games/list");
      const json = await res.json();
      const found = json.games?.find((g: GameInfo) => g.slug === slug);
      if (found) {
        setGame(found);
        setStake(found.min_stake);
      }

      await refreshOpenMatches();
    }
    load();
  }, [slug, refreshOpenMatches]);

  // Live update: another player creating/joining/cancelling a match
  // for this game shows up here immediately instead of only after a
  // manual reload - see hooks/use-matches-lobby-realtime.ts.
  useMatchesLobbyRealtime(refreshOpenMatches);

  // Safety-net poll in case the realtime websocket drops (backgrounded
  // tab, flaky mobile network) - same reasoning as MatchesLobbyLive.
  useEffect(() => {
    const interval = setInterval(refreshOpenMatches, 20000);
    return () => clearInterval(interval);
  }, [refreshOpenMatches]);

  async function createMatch() {
    setCreating(true);
    setMessage("");
    try {
      // Ludo is a 2-4 player game with its own seating/token state
      // (create_ludo_match in supabase/migrations/057_ludo.sql) - the
      // generic create_match RPC has no 'ludo' branch at all, so
      // calling it for this slug silently succeeds with an empty
      // game_state ({}) rather than erroring, and the board then
      // crashes trying to read state.seats/state.tokens off that empty
      // object. 8-Ball Pool similarly needs its own endpoint: the
      // generic create_match RPC only seeds a correctly-shaped
      // *placeholder* rack (balls: []); /api/pool/create additionally
      // shuffles and persists the real rack via seed_pool_rack (see
      // supabase/migrations/065_eight_ball_pool_fixes.sql). Every other
      // game still goes through the shared, slug-agnostic endpoint.
      const isLudo = slug === "ludo";
      const isPool = slug === "eight-ball-pool";
      const isWordRush = slug === "word-rush";
      
      const endpoint = isLudo 
        ? "/api/ludo/create" 
        : isPool 
          ? "/api/pool/create" 
          : isWordRush
            ? "/api/word-rush/create"
            : "/api/matches/create";

      const bodyData = isLudo
        ? { stake_amount: stake, max_players: maxPlayers }
        : (isPool || isWordRush)
          ? { stake_amount: stake }
          : { game_slug: slug, stake_amount: stake };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
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
      // Same reasoning as createMatch() above - joining a Ludo match
      // seats the joiner into the next open color slot
      // (join_ludo_match) rather than immediately flipping the match
      // to 'active' the way the generic 2-player join_match does,
      // since a 3-4 player Ludo match can still be waiting on more
      // seats after this join.
      const isLudo = slug === "ludo";
      const res = await fetch(isLudo ? "/api/ludo/join" : "/api/matches/join", {
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
      <Link
        href="/games"
        className="flex items-center gap-1 text-sm text-[var(--lj-muted)] hover:text-white"
      >
        ← All Games
      </Link>

      {/* Header */}
      <div className="relative flex items-center justify-between rounded-2xl bg-[var(--lj-card-2)] overflow-hidden shadow-sm border border-[var(--lj-border)]">
        <div className="p-6 relative z-10">
          <h1 className="text-3xl font-extrabold text-white drop-shadow-sm">
            {game.name}
          </h1>
          <p className="mt-1 text-sm font-medium text-[var(--lj-text)] bg-white/60 px-2 py-1 rounded inline-block backdrop-blur-sm">
            Stake {game.min_stake.toLocaleString()}–
            {game.max_stake.toLocaleString()} XAF
          </p>
        </div>
        <div className="absolute top-0 right-0 h-full w-1/2 md:w-1/3">
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
          {imgFailed ? (
            <div className="flex h-full items-center justify-center bg-[var(--lj-card)]">
              <Gamepad2 size={40} className="text-[var(--lj-muted)]" />
            </div>
          ) : (
            <Image
              src={`/images/${slug.trim().toLowerCase()}.png`}
              alt={game.name}
              fill
              className="object-cover object-right opacity-90"
              priority
              onError={() => setImgFailed(true)}
            />
          )}
        </div>
      </div>

      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${message.startsWith("✅") ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}
        >
          {message}
        </div>
      )}

      {/* Create match */}
      <div className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-5 shadow-sm space-y-4">
        <h2 className="font-bold text-white">Create a Match</h2>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--lj-muted)] uppercase tracking-wide">
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
          <p className="mt-1 text-xs text-[var(--lj-muted)]">
            Winner takes {(stake * 2 * 0.95).toLocaleString()} XAF (after 5%
            platform fee)
          </p>
        </div>

        {slug === "ludo" && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--lj-muted)] uppercase tracking-wide">
              Players
            </label>
            <div className="flex gap-2">
              {([2, 3, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxPlayers(n)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                    maxPlayers === n
                      ? "border-green-500 bg-green-500/10 text-green-300"
                      : "border-[var(--lj-border)] text-[var(--lj-muted)] hover:bg-white/5"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--lj-muted)]">
              Total pot: {(stake * maxPlayers * 0.95).toLocaleString()} XAF net to the winner
            </p>
          </div>
        )}

        <button
          onClick={createMatch}
          disabled={
            creating || stake < game.min_stake || stake > game.max_stake
          }
          className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {creating
            ? "Creating…"
            : `Create Match — ${stake.toLocaleString()} XAF`}
        </button>
      </div>

      {/* Open matches */}
      <div className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-5 shadow-sm">
        <h2 className="mb-3 font-bold text-white">
          Open Matches
          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-300">
            {openMatches.length}
          </span>
        </h2>

        {openMatches.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--lj-muted)]">
            No open matches yet — create the first one!
          </p>
        ) : (
          <div className="space-y-2">
            {openMatches.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {m.creator?.avatar_url ? (
                    <Image
                      src={m.creator.avatar_url}
                      alt={m.creator.username}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                      {m.creator?.username?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {m.creator?.username ?? "Unknown player"}
                    </p>
                    <p className="text-xs text-[var(--lj-muted)]">
                      {m.stake_amount.toLocaleString()} XAF stake · Pot:{" "}
                      {(m.stake_amount * (m.max_players ?? 2) * 0.95).toLocaleString()} XAF net
                    </p>
                  </div>
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
