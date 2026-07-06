"use client";

import { useCallback, useEffect, useState } from "react";
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
 */
export default function MatchesLobbyLive({ initialOpenMatches, initialLiveMatches }: Props) {
  const [openMatches, setOpenMatches] = useState(initialOpenMatches);
  const [liveMatches, setLiveMatches] = useState(initialLiveMatches);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/matches/lobby");
      const json = await res.json();
      if (json.success) {
        setOpenMatches(json.openMatches ?? []);
        setLiveMatches(json.liveMatches ?? []);
      }
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

  return (
    <>
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
        <MatchList matches={liveMatches} emptyMessage="No matches in progress right now." />
      </div>

      <div>
        <h2 className="mb-3 text-xl font-bold text-white">
          Open Matches <span className="ml-1 text-sm font-normal text-[var(--lj-muted)]">({openMatches.length})</span>
        </h2>
        <MatchList matches={openMatches} />
      </div>
    </>
  );
}
