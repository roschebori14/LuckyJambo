"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

const PRESENCE_CHANNEL = "presence:online-users";

const OnlineUsersContext = createContext<Set<string>>(new Set());

/**
 * Tracks the current user on a shared Supabase Realtime presence channel
 * and exposes the live set of every online user's id to descendants via
 * context. Mount this once near the root of the authenticated app so a
 * single websocket subscription powers online/offline indicators
 * everywhere (friends list, profile badges, etc).
 */
export function PresenceProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    });

    const syncOnlineIds = () => {
      const state = channel.presenceState();
      setOnlineIds(new Set(Object.keys(state)));
    };

    channel
      .on("presence", { event: "sync" }, syncOnlineIds)
      .on("presence", { event: "join" }, syncOnlineIds)
      .on("presence", { event: "leave" }, syncOnlineIds)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <OnlineUsersContext.Provider value={onlineIds}>
      {children}
    </OnlineUsersContext.Provider>
  );
}

/** Returns the live set of online user ids. */
export function useOnlineUsers() {
  return useContext(OnlineUsersContext);
}

/** Convenience helper for a single user id. */
export function useIsOnline(userId: string | null | undefined) {
  const online = useOnlineUsers();
  return !!userId && online.has(userId);
}
