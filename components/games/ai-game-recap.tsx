"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

export default function AiGameRecap({ matchId }: { matchId: string }) {
  const [recap, setRecap] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchRecap() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/game-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "Couldn't generate a recap");
        return;
      }
      setRecap(data.recap);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (recap) {
    return (
      <div className="mt-6 w-full max-w-md rounded-xl border border-[var(--lj-border)] bg-white/5 p-4 text-left">
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[var(--lj-cyan)]">
          <Sparkles size={14} /> AI Recap
        </h4>
        <p className="whitespace-pre-line text-sm text-[var(--lj-muted)]">{recap}</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
      <button
        onClick={fetchRecap}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl border border-[var(--lj-border)] px-5 py-2.5 text-sm font-semibold text-[var(--lj-cyan)] hover:bg-white/5 disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {loading ? "Analyzing your game…" : "Get AI Recap"}
      </button>
    </div>
  );
}
