import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Trophy, Crown } from "lucide-react";

interface WinRow { user_id: string; username: string; wins: number }
interface EarnerRow { user_id: string; username: string; earned: number }

const MEDAL: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

function LeaderboardTable({ rows, valueKey, valueSuffix }: { rows: (WinRow | EarnerRow)[]; valueKey: "wins" | "earned"; valueSuffix: string }) {
  return (
    <div className="lj-card overflow-hidden">
      <div className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
        {rows.map((row, i) => (
          <div key={row.user_id} className="flex items-center gap-3 px-5 py-3">
            <span className="w-8 text-center text-lg">
              {MEDAL[i] ?? <span className="text-sm font-bold text-[var(--lj-muted)]">#{i + 1}</span>}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-black text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg,var(--lj-blue),var(--lj-cyan))" }}>
              {row.username?.[0]?.toUpperCase() ?? "?"}
            </div>
            <Link href={`/profile/${row.username}`} className="flex-1 font-medium text-white hover:underline">
              {row.username}
            </Link>
            <span className="font-bold" style={{ color: "var(--lj-success)" }}>
              {(valueKey === "wins" ? (row as WinRow).wins : (row as EarnerRow).earned).toLocaleString()} {valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function LeaderboardPage() {
  const supabase = await createClient();

  // These call SECURITY DEFINER RPCs (migration 031) rather than
  // querying `matches` / `wallet_ledger` directly - both tables are
  // RLS-scoped to the querying user, so a direct query here would
  // only ever reflect the current visitor's own matches/earnings,
  // never a real cross-player leaderboard.
  const [{ data: topWins }, { data: topEarners }] = await Promise.all([
    supabase.rpc("get_leaderboard_wins", { p_limit: 20 }),
    supabase.rpc("get_leaderboard_earners", { p_limit: 20 }),
  ]);

  const wins = (topWins ?? []) as WinRow[];
  const earners = (topEarners ?? []) as EarnerRow[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="lj-page-header -mx-4 -mt-4 px-4 pb-5 pt-4 md:-mx-6 md:-mt-6 md:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white"><Trophy size={24} style={{ color: "var(--lj-cyan)" }} /> Leaderboard</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--lj-muted)]"><Crown size={14}/> Most Wins</h2>
          {wins.length > 0 ? <LeaderboardTable rows={wins} valueKey="wins" valueSuffix="W" /> : <div className="lj-card p-8 text-center text-sm text-[var(--lj-muted)]">No completed matches yet</div>}
        </div>
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--lj-muted)]"><Trophy size={14}/> Most Earned</h2>
          {earners.length > 0 ? <LeaderboardTable rows={earners} valueKey="earned" valueSuffix="XAF" /> : <div className="lj-card p-8 text-center text-sm text-[var(--lj-muted)]">No earnings yet</div>}
        </div>
      </div>
    </div>
  );
}
