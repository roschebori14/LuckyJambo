"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
};

/**
 * Subscribes to new notifications rows for `userId` - mirrors
 * use-direct-message-realtime.ts exactly (unique-per-instance channel
 * via useId, so this can't collide with any other subscription for
 * the same user). notify_user() has populated this table from all
 * over the app for a long time (match found, match settled, withdrawal
 * processed, friend request...); this is what finally lets that surface
 * live instead of only being visible on a manual visit to /notifications.
 */
export function useNotificationRealtime(
  userId: string | undefined | null,
  onInsert: (row: NotificationRow) => void,
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
      .channel(`notifications:${userId}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onInsertRef.current(payload.new as NotificationRow);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, instanceId]);
}
