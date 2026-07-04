"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// The full `matches` row shape isn't imported here on purpose — every
// board reads different columns (game_state, status, winner_id...) and
// this hook is intentionally generic so it can back all of them.
type MatchRow = Record<string, unknown>;

/**
 * Subscribes to live UPDATE events on a single match's row via Supabase
 * Realtime (Postgres CDC), so every player sees status/board changes the
 * instant the other side moves instead of waiting for the next poll.
 *
 * This is additive: existing polling loops in the board components are
 * left in place as a fallback, so if the websocket is ever unavailable
 * (blocked network, brief disconnect, etc.) gameplay degrades gracefully
 * back to the old poll-only behavior instead of breaking.
 *
 * RLS still applies to the underlying replication stream, so a payload
 * only ever reaches a client who is allowed to select that match row
 * (the "view own matches" policy - creator, participant, or a still-open
 * "waiting" match).
 */
export function useMatchRealtime(
  matchId: string | undefined | null,
  onUpdate: (row: MatchRow) => void
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!matchId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`match-updates:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          onUpdateRef.current(payload.new as MatchRow);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);
}
