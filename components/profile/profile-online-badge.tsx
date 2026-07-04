"use client";

import { useIsOnline } from "@/lib/presence/presence-context";

/** Small dot overlaid on an avatar showing live online status. There's
 *  no `is_online` column on `profiles` - online status is derived
 *  live from the shared presence channel (lib/presence/presence-context),
 *  the same source the friends list already uses, so this stays in
 *  sync without a page refresh. */
export default function ProfileOnlineBadge({ userId }: { userId: string }) {
  const online = useIsOnline(userId);

  return (
    <span
      className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2"
      style={{
        background: online ? "var(--lj-success)" : "var(--lj-muted)",
        borderColor: "var(--lj-card)",
      }}
      title={online ? "Online" : "Offline"}
    />
  );
}
