"use client";

import { useRef } from "react";
import { useDirectMessageRealtime, type DirectMessageRow } from "@/hooks/use-direct-message-realtime";
import { useToast } from "@/components/ui/toast-provider";
import { createClient } from "@/lib/supabase/client";

/**
 * Mounted once near the root of the authenticated app (see
 * (protected)/layout.tsx). Listens for new direct_messages addressed
 * to the current user across every conversation, and surfaces each
 * one as a toast - this is what makes a DM "noticeable" regardless of
 * which page the recipient happens to be on when it arrives, rather
 * than only showing up if they happen to have that conversation open.
 *
 * Renders nothing itself; all the visible UI lives in ToastProvider.
 */
export default function DmToastListener({ userId }: { userId: string }) {
  const { pushToast } = useToast();
  // Small in-memory cache so repeated messages from the same sender in
  // a short burst don't each trigger a fresh profile lookup.
  const usernameCache = useRef<Map<string, string>>(new Map());

  useDirectMessageRealtime(userId, async (row: DirectMessageRow) => {
    let senderName = usernameCache.current.get(row.sender_id);

    if (!senderName) {
      try {
        const supabase = createClient();
        const { data } = await supabase.rpc("get_public_profiles_by_ids", {
          p_ids: [row.sender_id],
        });
        senderName = data?.[0]?.username ?? "Someone";
        usernameCache.current.set(row.sender_id, senderName ?? "Someone");
      } catch {
        senderName = "Someone";
      }
    }

    pushToast({
      title: `💬 ${senderName}`,
      message: row.message,
      href: `/messages/${row.sender_id}`,
      icon: "message",
    });
  });

  return null;
}
