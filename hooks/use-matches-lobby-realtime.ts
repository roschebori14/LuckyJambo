"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Fires `onChange` whenever a row in `matches` is inserted or updated -
 * this is what makes a newly created match (or one flipping from
 * waiting -> active, or being cancelled) show up for everyone
 * currently sitting on the Matchmaking page, instead of only
 * appearing after a manual reload.
 *
 * No `filter` on the subscription (unlike useDirectMessageRealtime,
 * which filters to one user's inbox) - the lobby's own RLS policy
 * ("view own or spectatable matches", migration 049) already allows
 * reading every waiting/active/completed row, and the two lists this
 * powers (Open Matches, Active Matches) are platform-wide by design,
 * not scoped to the current user. Filtering client-side by re-fetching
 * the already-scoped /api/matches/lobby endpoint is simpler and less
 * bug-prone than trying to mirror every branch of that RLS policy (plus
 * the invited_user_id / private-challenge logic) again here.
 *
 * Deliberately does NOT try to patch individual rows into local state
 * from the realtime payload directly - a raw `matches` row has no
 * joined game name/slug or creator username (see LobbyMatch /
 * getLobbyData), so every event just triggers a debounced refetch of
 * the whole lobby instead. Lobby traffic is low-frequency; a full
 * refetch per burst of changes is simpler and far less bug-prone than
 * hand-reconstructing joined data from a partial realtime row.
 */
export function useMatchesLobbyRealtime(onChange: () => void) {
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });
  const instanceId = useId();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRefetch() {
      if (debounceTimer) clearTimeout(debounceTimer);
      // 400ms: enough to coalesce "insert then immediately updated"
      // bursts (e.g. create_match followed by a fleet-placement update
      // on battleship) into a single refetch, short enough that a new
      // match still feels instant to everyone watching the lobby.
      debounceTimer = setTimeout(() => onChangeRef.current(), 400);
    }

    // Same session/auth race fix as useDirectMessageRealtime: the
    // Realtime websocket only evaluates RLS correctly once
    // `realtime.setAuth` has been called with a real access token, and
    // that requires awaiting the (async, cookie-reading) session first.
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel(`matches-lobby:${instanceId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "matches" },
          scheduleRefetch,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "matches" },
          scheduleRefetch,
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(`[useMatchesLobbyRealtime] subscription failed (${status}).`, err);
          }
        });
    })();

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      authSubscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [instanceId]);
}
