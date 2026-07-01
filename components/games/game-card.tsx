"use client";

import Link from "next/link";
import { Users, Zap } from "lucide-react";

import Image from "next/image";

interface Game {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  min_stake: number;
  max_stake: number;
}

const GAME_META: Record<string, { type: string; bg: string }> = {
  chess:               { type: "Turn-based", bg: "bg-slate-900" },
  draughts:            { type: "Turn-based", bg: "bg-red-950" },
  "tic-tac-toe":       { type: "Turn-based", bg: "bg-blue-950" },
  dice:                { type: "Instant",    bg: "bg-purple-950" },
  rock_paper_scissors: { type: "Instant",    bg: "bg-orange-950" },
  coin_flip:           { type: "Instant",    bg: "bg-yellow-950" },
};

export default function GameCard({ game }: { game: Game }) {
  const meta = GAME_META[game.slug] ?? { type: "Game", bg: "bg-gray-900" };
  const isInstant = meta.type === "Instant";

  return (
    <div className="lj-card lj-card-hover group flex flex-col overflow-hidden">
      {/* Header */}
      <div className={`relative h-48 w-full flex items-center justify-center ${meta.bg}`}>
        <Image 
          src={`/images/${game.slug}.png`}
          alt={game.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        <span className={`absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm ${isInstant ? "bg-yellow-400/30 text-yellow-100" : "bg-blue-400/30 text-blue-100"}`}>
          {isInstant ? <Zap size={8} /> : <Users size={8} />}
          {meta.type}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4 relative z-10 bg-[var(--lj-surface)]">
        <h3 className="font-bold text-white text-lg">{game.name}</h3>

        <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--lj-muted)]">
          <span>Min {game.min_stake.toLocaleString()} XAF</span>
          <span>Max {game.max_stake.toLocaleString()} XAF</span>
        </div>

        <Link href={`/games/${game.slug}`}
          className="lj-btn-primary mt-4 flex items-center justify-center gap-1.5 text-sm"
          style={{ padding: "10px 16px" }}>
          Play Now
        </Link>
      </div>
    </div>
  );
}
