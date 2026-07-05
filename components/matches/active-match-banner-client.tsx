"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ActiveMatchEntry {
  id: string;
  gameName: string;
  gameSlug: string;
  stakeAmount: number;
}

export default function ActiveMatchBannerClient({ matches }: { matches: ActiveMatchEntry[] }) {
  const pathname = usePathname();

  // Don't show "resume this match" while you're already looking at it.
  const visible = matches.filter((m) => pathname !== `/games/${m.gameSlug}/match/${m.id}`);

  if (visible.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {visible.map((m) => (
        <Link
          key={m.id}
          href={`/games/${m.gameSlug}/match/${m.id}`}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg, var(--lj-success) 0%, #059669 100%)" }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          Resume {m.gameName} — {m.stakeAmount.toLocaleString()} XAF match in progress
        </Link>
      ))}
    </div>
  );
}
