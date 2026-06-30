import { createClient } from "@/lib/supabase/server";
import GameCard from "@/components/games/game-card";
import { Gamepad2 } from "lucide-react";

interface Game {
  id: string; name: string; slug: string;
  description: string | null; min_stake: number; max_stake: number;
}

export default async function GamesPage() {
  const supabase = await createClient();
  const { data: games } = await supabase
    .from("games").select("id,name,slug,description,min_stake,max_stake")
    .eq("is_active", true).order("name");

  const turnBased = (games ?? []).filter(g => ["chess","draughts","tic-tac-toe"].includes(g.slug));
  const instant   = (games ?? []).filter(g => !["chess","draughts","tic-tac-toe"].includes(g.slug));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="lj-page-header -mx-4 -mt-4 px-4 pb-5 pt-4 md:-mx-6 md:-mt-6 md:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <Gamepad2 size={24} style={{ color: "var(--lj-cyan)" }} /> Games
        </h1>
        <p className="mt-1 text-sm text-[var(--lj-muted)]">Pick a game, set your stake, and challenge someone for real XAF</p>
      </div>

      {turnBased.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--lj-muted)]">Turn-Based</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {turnBased.map(g => <GameCard key={g.id} game={g as Game} />)}
          </div>
        </div>
      )}

      {instant.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--lj-muted)]">Instant Games</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {instant.map(g => <GameCard key={g.id} game={g as Game} />)}
          </div>
        </div>
      )}

      {(!games || games.length === 0) && (
        <div className="lj-card flex flex-col items-center justify-center py-20 text-center">
          <Gamepad2 size={48} className="mb-4 text-[var(--lj-muted)]" />
          <p className="font-semibold text-white">No games yet</p>
          <p className="mt-1 text-sm text-[var(--lj-muted)]">Run seed.sql in Supabase to add games</p>
        </div>
      )}
    </div>
  );
}
