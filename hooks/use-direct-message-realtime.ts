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
    const channel = supabase
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
        // Supabase dashboard. This previously failed completely
        // silently - no toast, no error - which made the missing-toast
        // bug look like a UI issue when it was really a subscription
        // that never went live.
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, instanceId]);
}
