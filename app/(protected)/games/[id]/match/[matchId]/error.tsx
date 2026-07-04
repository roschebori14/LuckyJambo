"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

// This route has none of these until now. A live match page is the
// most volatile screen in the app (two players' actions, a poller, and
// a realtime subscription are all touching state at once) - without an
// error boundary here, any uncaught render exception (a malformed
// game_state, a null player id, etc.) takes down the whole page with
// nothing to recover from except a manual URL reload, and on some
// mobile browsers/WebViews an uncaught client exception like that can
// present as a generic "this page couldn't load" failure rather than
// anything actionable.
export default function MatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Match page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-8 text-center shadow-sm">
      <AlertTriangle size={32} className="text-red-400" />
      <h3 className="text-xl font-bold text-white">Something went wrong loading this match</h3>
      <p className="max-w-sm text-sm text-[var(--lj-muted)]">
        This is usually temporary - your match and wallet are unaffected. Try reloading the page.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          <RotateCw size={14} /> Try again
        </button>
        <Link
          href="/matches"
          className="rounded-xl border border-[var(--lj-border)] px-5 py-2.5 text-sm font-semibold text-[var(--lj-muted)] hover:bg-white/5"
        >
          Back to Matches
        </Link>
      </div>
    </div>
  );
}
