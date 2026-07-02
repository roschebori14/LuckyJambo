"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, CheckCircle2, AlertCircle } from "lucide-react";

interface InviteOwner {
  id: string;
  username: string;
  avatar_url: string | null;
  is_verified: boolean;
}

export default function InviteAcceptCard({
  code,
  owner,
}: {
  code: string;
  owner: InviteOwner;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function acceptInvite() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/friends/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Could not accept invite");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="lj-card space-y-4 p-6 text-center">
        <CheckCircle2 size={40} className="mx-auto" style={{ color: "var(--lj-success)" }} />
        <h1 className="text-lg font-bold text-white">
          You&apos;re now friends with {owner.username}
        </h1>
        <Link href="/friends" className="lj-btn-primary inline-flex">
          Go to Friends
        </Link>
      </div>
    );
  }

  return (
    <div className="lj-card space-y-5 p-6 text-center">
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-xl font-black text-white"
        style={{ background: "linear-gradient(135deg, var(--lj-blue) 0%, var(--lj-cyan) 100%)" }}
      >
        {owner.username.slice(0, 2).toUpperCase()}
      </div>

      <div>
        <p className="text-sm text-[var(--lj-muted)]">You&apos;ve been invited by</p>
        <h1 className="text-lg font-bold text-white">{owner.username}</h1>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-left text-sm"
          style={{ background: "rgba(255, 61, 90, 0.1)", color: "var(--lj-danger)" }}
        >
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}

      <button
        onClick={acceptInvite}
        disabled={status === "loading"}
        className="lj-btn-primary flex w-full items-center justify-center gap-2"
      >
        <UserPlus size={16} />
        {status === "loading" ? "Adding friend…" : `Add ${owner.username} as a friend`}
      </button>
    </div>
  );
}
