"use client";

import { useEffect, useState } from "react";
import { Link2, Copy, Check } from "lucide-react";

export default function InviteLinkCard() {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/friends/invite")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success) setLink(json.link);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="lj-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-bold text-white">
        <Link2 size={16} style={{ color: "var(--lj-cyan)" }} /> Invite Friends
      </h2>
      <p className="mb-3 text-sm text-[var(--lj-muted)]">
        Share your link — anyone who opens it while signed in becomes your friend instantly.
      </p>
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--lj-border)" }}
      >
        <input
          readOnly
          value={loading ? "Loading your link…" : link}
          className="flex-1 truncate bg-transparent text-xs text-[var(--lj-text)] outline-none"
        />
        <button
          onClick={copyLink}
          disabled={loading}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-colors disabled:opacity-50"
          style={{ background: "var(--lj-blue)" }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
