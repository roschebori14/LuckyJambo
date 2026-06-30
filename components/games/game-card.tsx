"use client";

import Link from "next/link";
import { Users, Zap } from "lucide-react";

interface Game {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  min_stake: number;
  max_stake: number;
}

const GAME_META: Record<string, { icon: string; gradient: string; type: string }> = {
  chess:               { icon: "♟", gradient: "from-slate-600 to-slate-900",     type: "Turn-based" },
  draughts:            { icon: "⬤", gradient: "from-red-700 to-red-900",         type: "Turn-based" },
  "tic-tac-toe":       { icon: "✕○", gradient: "from-blue-600 to-blue-900",       type: "Turn-based" },
  dice:                { icon: "⚄", gradient: "from-purple-600 to-purple-900",    type: "Instant" },
  rock_paper_scissors: { icon: "✊", gradient: "from-orange-600 to-orange-900",   type: "Instant" },
  coin_flip:           { icon: "◉", gradient: "from-yellow-600 to-yellow-900",    type: "Instant" },
};

export default function GameCard({ game }: { game: Game }) {
  const meta = GAME_META[game.slug] ?? { icon: "🎮", gradient: "from-blue-600 to-blue-900", type: "Game" };
  const isInstant = meta.type === "Instant";

  return (
    <div className="lj-card lj-card-hover group flex flex-col overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-br ${meta.gradient} relative flex items-center justify-center py-8`}>
        <span className="text-5xl select-none font-bold drop-shadow-lg">{meta.icon}</span>
        <span className={`absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${isInstant ? "bg-yellow-400/20 text-yellow-300" : "bg-blue-400/20 text-blue-200"}`}>
          {isInstant ? <Zap size={8} /> : <Users size={8} />}
          {meta.type}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold text-white">{game.name}</h3>

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
