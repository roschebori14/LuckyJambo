"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, Check, Clock, Swords, AlertCircle } from "lucide-react";
import type { FriendshipStatus } from "@/types/profile";

export default function ProfileActions({
  targetId,
  username,
  initialStatus,
}: {
  targetId: string;
  username: string;
  initialStatus: FriendshipStatus;
}) {
  const [status, setStatus] = useState<FriendshipStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendRequest() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: targetId }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Could not send request");
        return;
      }
      setStatus("request_sent");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "friends") {
    return (
      <div className="flex w-full gap-2">
        <span
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white"
          style={{ background: "var(--lj-success)" }}
        >
          <Check size={14} /> Friends
        </span>
        <Link
          href="/matches"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white transition-colors hover:brightness-110"
          style={{ background: "var(--lj-blue)" }}
        >
          <Swords size={14} /> Challenge
        </Link>
      </div>
    );
  }

  if (status === "request_sent") {
    return (
      <span
        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white opacity-70"
        style={{ background: "var(--lj-blue)" }}
      >
        <Clock size={14} /> Request Sent
      </span>
    );
  }

  if (status === "request_received") {
    return (
      <p className="text-sm text-[var(--lj-muted)]">
        {username} sent you a friend request —{" "}
        <Link href="/friends" className="underline" style={{ color: "var(--lj-cyan)" }}>
          respond from Friends
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="w-full space-y-2">
      <button
        onClick={sendRequest}
        disabled={loading}
        className="lj-btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-60"
      >
        <UserPlus size={16} />
        {loading ? "Sending…" : `Add ${username} as a friend`}
      </button>

      {error && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
          style={{ background: "rgba(255, 61, 90, 0.1)", color: "var(--lj-danger)" }}
        >
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}
