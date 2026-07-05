"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type MatchChatRow = {
  id: string;
  match_id: string;
  user_id: string;
  message: string;
  created_at: string;
};

/**
 * Subscribes to new rows on match_chat_messages for a single match via
 * Supabase Realtime, so a quick-chat message shows up for the other
 * player instantly instead of waiting on a poll.
 *
 * Mirrors hooks/use-match-realtime.ts: a unique-per-instance channel
 * topic (via useId) so multiple mounts/unmounts of the chat widget
 * (e.g. fast refresh, navigating away and back) never fight over one
 * shared channel object.
 *
 * RLS ("view own match chat" in 047_match_chat.sql) still applies to
 * the replication stream itself - a payload only ever reaches a client
 * who is allowed to select that match's chat.
 */
export function useMatchChatRealtime(
  matchId: string | undefined | null,
  onInsert: (row: MatchChatRow) => void,
) {
  const onInsertRef = useRef(onInsert);
  useLayoutEffect(() => {
    onInsertRef.current = onInsert;
  });
  const instanceId = useId();

  useEffect(() => {
    if (!matchId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`match-chat:${matchId}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_chat_messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          onInsertRef.current(payload.new as MatchChatRow);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, instanceId]);
}
