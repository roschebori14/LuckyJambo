"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MatchList from "./match-list";
import { useMatchesLobbyRealtime } from "@/hooks/use-matches-lobby-realtime";
import type { LobbyMatch } from "@/lib/matchmaking/lobby-service";

interface Props {
  initialOpenMatches: LobbyMatch[];
  initialLiveMatches: LobbyMatch[];
}

/**
 * Renders the "Active Matches" and "Open Matches" sections of
 * app/(protected)/matches/page.tsx. Starts from the server-rendered
 * data (fast first paint, no loading flash) and then keeps both lists
 * live via useMatchesLobbyRealtime - this is what fixes "another user
 * creates a match and it doesn't show up until I reload the page".
 *
 * Also tracks which match ids are brand new since the page loaded, so
 * MatchList/MatchCard can give a freshly-arrived match a one-time gold
 * glow instead of it silently appearing in the grid - the whole point
 * of wiring this up live is that it should *feel* live.
 */
export default function MatchesLobbyLive({ initialOpenMatches, initialLiveMatches }: Props) {
  const [openMatches, setOpenMatches] = useState(initialOpenMatches);
  const [liveMatches, setLiveMatches] = useState(initialLiveMatches);
  const [justArrivedIds, setJustArrivedIds] = useState<Set<string>>(new Set());

  const knownIdsRef = useRef<Set<string>>(
    new Set([...initialOpenMatches, ...initialLiveMatches].map((m) => m.id)),
  );

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/matches/lobby");
      const json = await res.json();
      if (!json.success) return;

      const nextOpen: LobbyMatch[] = json.openMatches ?? [];
      const nextLive: LobbyMatch[] = json.liveMatches ?? [];
      const nextIds = new Set([...nextOpen, ...nextLive].map((m) => m.id));

      const arrivedIds = [...nextIds].filter((id) => !knownIdsRef.current.has(id));
      if (arrivedIds.length > 0) {
        setJustArrivedIds((prev) => new Set([...prev, ...arrivedIds]));
        // Matches .lj-arrive's 2.4s glow with a little headroom so the
        // "Just now" pill doesn't disappear mid-animation.
        setTimeout(() => {
          setJustArrivedIds((prev) => {
            const next = new Set(prev);
            arrivedIds.forEach((id) => next.delete(id));
            return next;
          });
        }, 4000);
      }

      knownIdsRef.current = nextIds;
      setOpenMatches(nextOpen);
      setLiveMatches(nextLive);
    } catch {
      // A missed refresh isn't fatal - the next realtime event (or the
      // 20s safety-net poll below) will catch the lobby up again.
    }
  }, []);

  useMatchesLobbyRealtime(refetch);

  // Realtime covers the common case, but a low-frequency safety-net
  // poll means a dropped websocket (flaky mobile network, a tab that
  // was backgrounded and throttled, etc.) can't leave someone staring
  // at a stale lobby indefinitely.
  useEffect(() => {
    const interval = setInterval(refetch, 20000);
    return () => clearInterval(interval);
  }, [refetch]);

  const totalStaked = [...openMatches, ...liveMatches].reduce((sum, m) => sum + m.stakeAmount, 0);

  return (
    <>
      {/* Live snapshot strip - the one place this page shows off that
          it's actually watching the table in realtime, not just on load. */}
      <div className="flex flex-wrap gap-3 text-xs">
        <StatChip label="Open" value={openMatches.length} dotClass="bg-blue-400" />
        <StatChip label="Live" value={liveMatches.length} dotClass="bg-green-400" pulse />
        <StatChip label="Staked right now" value={`${totalStaked.toLocaleString()} XAF`} dotClass="bg-[var(--lj-gold)]" gold />
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-white">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>
          Active Matches <span className="ml-1 text-sm font-normal text-[var(--lj-muted)]">({liveMatches.length})</span>
        </h2>
        <p className="mb-3 text-xs text-[var(--lj-muted)]">
          Yours are marked <strong className="text-white">Resume</strong> — jump back in from anywhere,
          even if you closed the tab. Everyone else's are open to <strong className="text-white">Spectate</strong>.
        </p>
        <MatchList matches={liveMatches} emptyMessage="No matches in progress right now." justArrivedIds={justArrivedIds} />
      </div>

      <div>
        <h2 className="mb-3 text-xl font-bold text-white">
          Open Matches <span className="ml-1 text-sm font-normal text-[var(--lj-muted)]">({openMatches.length})</span>
        </h2>
        <MatchList matches={openMatches} justArrivedIds={justArrivedIds} />
      </div>
    </>
  );
}

function StatChip({
  label,
  value,
  dotClass,
  pulse = false,
  gold = false,
}: {
  label: string;
  value: string | number;
  dotClass: string;
  pulse?: boolean;
  gold?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--lj-border)] bg-white/[0.03] px-3.5 py-1.5">
      <span className="relative flex h-1.5 w-1.5">
        {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotClass}`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotClass}`} />
      </span>
      <span className={`font-bold ${gold ? "lj-stake" : "text-white"}`}>{value}</span>
      <span className="text-[var(--lj-muted)]">{label}</span>
    </div>
  );
}
