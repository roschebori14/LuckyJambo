"use client";

import { useNotificationRealtime, type NotificationRow } from "@/hooks/use-notification-realtime";
import { useToast } from "@/components/ui/toast-provider";
import { useSound } from "@/lib/sound/sound-manager";

/**
 * Mounted once near the root of the authenticated app, alongside
 * DmToastListener (see (protected)/layout.tsx). notify_user() has
 * written rows into `notifications` from all over the app for a long
 * time - match found, match settled, withdrawal auto-processed, friend
 * request, direct challenge - but nothing ever surfaced them live
 * before now, and only direct messages got a toast/sound. This closes
 * that gap generically, for every notification, not per-event-type.
 *
 * Renders nothing itself; all visible UI lives in ToastProvider.
 */
export default function NotificationToastListener({ userId }: { userId: string }) {
  const { pushToast } = useToast();
  const { play } = useSound();

  useNotificationRealtime(userId, (row: NotificationRow) => {
    const title = row.title ?? "";
    // A couple of notification types have their own more specific
    // sound in the catalog; everything else gets the generic
    // "notification" chime, which ToastProvider already plays
    // automatically for any non-silent toast.
    const lowerTitle = title.toLowerCase();
    let specificSound: "deposit-success" | "withdrawal-success" | "match-found" | null = null;
    if (lowerTitle.includes("withdrawal")) specificSound = "withdrawal-success";
    else if (lowerTitle.includes("deposit")) specificSound = "deposit-success";
    else if (lowerTitle.includes("opponent") || lowerTitle.includes("joined")) specificSound = "match-found";

    if (specificSound) play(specificSound);

    pushToast({
      title: title || "Notification",
      message: row.message ?? "",
      href: "/notifications",
      icon: "bell",
      silent: !!specificSound,
    });
  });

  return null;
}
