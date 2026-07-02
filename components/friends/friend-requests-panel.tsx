"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FriendRequestCard from "./friend-request-card";

interface RequestItem {
  id: string;
  created_at: string;
  sender: {
    id: string;
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

export default function FriendRequestsPanel({
  requests,
}: {
  requests: RequestItem[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(requests);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function respond(requestId: string, action: "accepted" | "rejected") {
    setBusyId(requestId);
    try {
      const res = await fetch("/api/friends/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, action }),
      });
      const json = await res.json();
      if (json.success) {
        setPending((prev) => prev.filter((r) => r.id !== requestId));
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  if (pending.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--lj-muted)]">
        Pending Requests ({pending.length})
      </h2>
      <div className="space-y-2">
        {pending.map((r) => (
          <FriendRequestCard
            key={r.id}
            requestId={r.id}
            username={r.sender.username}
            busy={busyId === r.id}
            onAccept={(id) => respond(id, "accepted")}
            onReject={(id) => respond(id, "rejected")}
          />
        ))}
      </div>
    </div>
  );
}
