"use client";

import { useState } from "react";
import { Sparkles, RotateCw } from "lucide-react";

/**
 * Admin-only. Calls /api/ai/match-hint for a plain-English read on the
 * current position plus a suggested move for whoever is to move.
 *
 * The route itself re-checks admin status server-side (never trust
 * this component's visibility alone) - this exists so admins can get
 * a quick, live read on any in-progress match (whether they're playing
 * or just spectating), not so regular players can get move advice on
 * a real-money match they're staking on.
 */
export default function AdminMatchHint({ matchId }: { matchId: string }) {
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function fetchHint() {
    setLoading(true);
    setError("");
    setOpen(true);
    try {
      const res = await fetch("/api/ai/match-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const json = await res.json();
      if (json.success) {
        setHint(json.hint);
      } else {
        setError(json.message ?? "Couldn't get a hint right now");
      }
    } catch {
      setError("Network error - please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-3"
      style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.25)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
          <Sparkles size={13} /> Admin AI Assist
        </div>
        <button
          onClick={fetchHint}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-500/10 disabled:opacity-50"
          style={{ border: "1px solid rgba(168,85,247,0.35)" }}
        >
          <RotateCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Thinking…" : open ? "Refresh hint" : "Show hint"}
        </button>
      </div>

      {open && (
        <div className="mt-2 text-xs leading-relaxed text-[var(--lj-muted)]">
          {loading && !hint ? "Analyzing the position…" : error ? <span className="text-red-400">{error}</span> : hint}
        </div>
      )}
    </div>
  );
}
