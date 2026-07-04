"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
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
 *
 * IMPORTANT: this hook is called from more than one component for the
 * *same* matchId at the same time - GameClient (always mounted while a
 * match is open) and the specific board component it renders underneath
 * (TicTacToeBoard, ChessBoard, etc, once the match goes active) both
 * subscribe concurrently. The underlying supabase-js client is a
 * singleton in the browser (createBrowserClient caches it), and
 * `.channel(topic)` returns the *existing* channel object if one with
 * the same topic string is already open rather than creating a new one.
 * Two hook instances naively using `match-updates:${matchId}` as the
 * topic would therefore silently share one channel: whichever instance
 * subscribed first "wins" and the second instance's `.subscribe()` call
 * becomes a no-op against an already-open channel (its callback is
 * never told about anything), and either instance unmounting removes
 * the channel out from under the other one. A unique-per-instance
 * suffix (via useId) gives every call site its own independent channel,
 * so subscribing and cleanup are fully isolated regardless of how many
 * components are watching the same match at once.
 */
export function useMatchRealtime(
  matchId: string | undefined | null,
  onUpdate: (row: MatchRow) => void
) {
  const onUpdateRef = useRef(onUpdate);
  useLayoutEffect(() => {
    onUpdateRef.current = onUpdate;
  });
  const instanceId = useId();

  useEffect(() => {
    if (!matchId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`match-updates:${matchId}:${instanceId}`)
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
  }, [matchId, instanceId]);
}
