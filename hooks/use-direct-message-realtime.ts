"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type DirectMessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

/**
 * Subscribes to new direct_messages rows addressed to `userId`, across
 * ALL conversations at once (not scoped to one friend) - this is what
 * powers the global toast notification, since a DM can arrive while
 * the recipient is looking at any page in the app, not just an open
 * conversation thread.
 *
 * Mirrors use-match-chat-realtime.ts / use-match-realtime.ts: a
 * unique-per-instance channel topic (via useId) so this can safely be
 * mounted more than once (e.g. both the global toast listener and an
 * open conversation thread) without the two colliding on one shared
 * channel object.
 */
export function useDirectMessageRealtime(
  userId: string | undefined | null,
  onInsert: (row: DirectMessageRow) => void,
) {
  const onInsertRef = useRef(onInsert);
  useLayoutEffect(() => {
    onInsertRef.current = onInsert;
  });
  const instanceId = useId();

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // ROOT CAUSE of the "channel says SUBSCRIBED but INSERT never
    // fires" bug: postgres_changes RLS is evaluated against whatever
    // access_token the Realtime websocket authenticated with, and that
    // is only set once `supabase.auth.getSession()` resolves (it reads
    // cookies, so it's async). `DmToastListener` mounts at the very
    // root of the authenticated layout, so its effect used to call
    // `.channel(...).subscribe()` immediately - often winning the race
    // against session hydration. The socket then opened with no user
    // token, `auth.uid()` evaluated to NULL for every row, and
    // `receiver_id = auth.uid()` silently matched nothing - no error,
    // no dropped connection, just zero events delivered. Explicitly
    // awaiting the session and calling `realtime.setAuth(...)` before
    // subscribing closes that race.
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      } else {
        console.warn(
          `[useDirectMessageRealtime] no session yet for ${userId} - subscribing anyway, ` +
          "but RLS will reject every row until the token propagates.",
        );
      }

      channel = supabase
        .channel(`dm-inbox:${userId}:${instanceId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "direct_messages",
            filter: `receiver_id=eq.${userId}`,
          },
          (payload) => {
            // Confirms the event actually reached the browser. If this
            // never logs on a real send, the break is upstream (publication/
            // RLS/websocket) - not in DmToastListener or ToastProvider.
            console.log("[useDirectMessageRealtime] INSERT received:", payload.new);
            onInsertRef.current(payload.new as DirectMessageRow);
          },
        )
        .subscribe((status, err) => {
          // SUBSCRIBED = healthy. CHANNEL_ERROR / TIMED_OUT here almost
          // always means either (a) `direct_messages` was never actually
          // added to the `supabase_realtime` publication on this
          // project (migration 048 not applied to the live DB), or
          // (b) Realtime is disabled for this project/table in the
          // Supabase dashboard.
          console.log(`[useDirectMessageRealtime] channel status for ${userId}:`, status, err ?? "");
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(
              `[useDirectMessageRealtime] subscription for user ${userId} failed (${status}).`,
              "Check that 'direct_messages' is in the supabase_realtime publication",
              "and that RLS allows this user to SELECT their own rows.",
              err,
            );
          }
        });
    })();

    // Keep the realtime auth token fresh across refreshes/re-logins -
    // otherwise a token that expires mid-session would cause the same
    // "SUBSCRIBED but nothing arrives" symptom to come back after ~1hr.
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    return () => {
      cancelled = true;
      authSubscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, instanceId]);
}
