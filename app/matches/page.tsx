import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Swords, Plus } from "lucide-react";

export default async function MatchesPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("*, games(name, slug)")
    .or(`creator_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: participated } = await supabase
    .from("match_participants")
    .select("match_id")
    .eq("user_id", user.id);

  const participatedIds = new Set((participated ?? []).map(p => p.match_id));
  const allMatches = (matches ?? []).filter(m => m.creator_id === user.id || participatedIds.has(m.id));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="lj-page-header -mx-4 -mt-4 px-4 pb-5 pt-4 md:-mx-6 md:-mt-6 md:px-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <Swords size={24} style={{ color: "var(--lj-cyan)" }} /> My Matches
        </h1>
        <Link href="/games" className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--lj-blue), var(--lj-cyan))" }}>
          <Plus size={14} /> New Match
        </Link>
      </div>

      {allMatches.length === 0
        ? <div className="lj-card flex flex-col items-center py-20 text-center">
            <Swords size={40} className="mb-4 text-[var(--lj-muted)]" />
            <p className="font-semibold text-white">No matches yet</p>
            <Link href="/games" className="mt-3 text-sm text-[var(--lj-blue-2)] hover:text-[var(--lj-cyan)]">Browse games →</Link>
          </div>
        : <div className="space-y-2">
            {allMatches.map(m => {
              const game = (m.games as { name: string; slug: string } | null);
              const href = game ? `/games/${game.slug}/match/${m.id}` : "#";
              return (
                <Link key={m.id} href={href} className="lj-card lj-card-hover flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-semibold text-white">{game?.name ?? "Match"}</p>
                    <p className="text-xs text-[var(--lj-muted)]">{new Date(m.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-white">{m.stake_amount?.toLocaleString()} XAF</p>
                    <span className={`lj-badge ${
                      m.status === "active"    ? "bg-green-500/20 text-green-400" :
                      m.status === "waiting"   ? "bg-yellow-500/20 text-yellow-400" :
                      m.status === "completed" ? "bg-blue-500/20 text-blue-300" :
                      "bg-red-500/20 text-red-400"}`}>
                      {m.status}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
      }
    </div>
  );
}
