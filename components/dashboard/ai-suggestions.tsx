"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

interface Suggestion {
  suggested_game_slug: string;
  suggested_game_reason: string;
  suggested_opponent_username: string | null;
  suggested_opponent_reason: string | null;
}

export default function AiSuggestions() {
  const [data, setData] = useState<Suggestion | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/recommendations")
      .then(res => res.json())
      .then(json => {
        if (cancelled) return;
        if (json.success) setData(json);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, []);

  // Fail quietly - this is a nice-to-have widget, not core functionality.
  if (failed || !data) return null;

  return (
    <div className="lj-card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold text-white">
        <Sparkles size={16} style={{ color: "var(--lj-cyan)" }} /> Suggested For You
      </h2>
      <div className="space-y-3">
        <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p className="text-sm text-[var(--lj-muted)]">{data.suggested_game_reason}</p>
          <Link
            href={`/games/${data.suggested_game_slug}`}
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--lj-cyan)] hover:underline"
          >
            Try it →
          </Link>
        </div>

        {data.suggested_opponent_username && (
          <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-sm text-[var(--lj-muted)]">{data.suggested_opponent_reason}</p>
            <Link
              href={`/profile/${data.suggested_opponent_username}`}
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--lj-cyan)] hover:underline"
            >
              Challenge {data.suggested_opponent_username} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
