import { createClient } from "@/lib/supabase/server";
import { Trophy, Crown } from "lucide-react";

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: winners } = await supabase
    .from("matches")
    .select("winner_id, profiles!matches_winner_id_fkey(id, username)")
    .eq("status", "completed")
    .not("winner_id", "is", null)
    .limit(1000);

  const { data: earners } = await supabase
    .from("wallet_ledger")
    .select("user_id, amount, profiles!wallet_ledger_user_id_fkey(username)")
    .eq("type", "match_win")
    .limit(2000);

  const winMap = new Map<string, { username: string; wins: number }>();
  for (const m of winners ?? []) {
    const p = ((m.profiles as unknown) as { id: string; username: string } | null);
    if (!p) continue;
    const existing = winMap.get(p.id) ?? { username: p.username, wins: 0 };
    winMap.set(p.id, { ...existing, wins: existing.wins + 1 });
  }

  const earnerMap = new Map<string, { username: string; earned: number }>();
  for (const e of earners ?? []) {
    const p = ((e.profiles as unknown) as { username: string } | null);
    if (!p) continue;
    const existing = earnerMap.get(e.user_id) ?? { username: p.username, earned: 0 };
    earnerMap.set(e.user_id, { ...existing, earned: existing.earned + (e.amount ?? 0) });
  }

  const topWins = [...winMap.entries()].sort((a, b) => b[1].wins - a[1].wins).slice(0, 20);
  const topEarners = [...earnerMap.entries()].sort((a, b) => b[1].earned - a[1].earned).slice(0, 20);

  const MEDAL: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

  const Table = ({ rows, valueKey, valueSuffix }: { rows: [string, Record<string, string | number>][], valueKey: string, valueSuffix: string }) => (
    <div className="lj-card overflow-hidden">
      <div className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
        {rows.map(([id, data], i) => (
          <div key={id} className="flex items-center gap-3 px-5 py-3">
            <span className="w-8 text-center text-lg">{MEDAL[i] ?? <span className="text-sm font-bold text-[var(--lj-muted)]">#{i + 1}</span>}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-black text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg,var(--lj-blue),var(--lj-cyan))" }}>
              {(data.username as string)[0]?.toUpperCase()}
            </div>
            <span className="flex-1 font-medium text-white">{data.username as string}</span>
            <span className="font-bold" style={{ color: "var(--lj-success)" }}>
              {typeof data[valueKey] === "number" ? (data[valueKey] as number).toLocaleString() : data[valueKey]} {valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="lj-page-header -mx-4 -mt-4 px-4 pb-5 pt-4 md:-mx-6 md:-mt-6 md:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white"><Trophy size={24} style={{ color: "var(--lj-cyan)" }} /> Leaderboard</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--lj-muted)]"><Crown size={14}/> Most Wins</h2>
          {topWins.length > 0 ? <Table rows={topWins as [string, Record<string, string | number>][]} valueKey="wins" valueSuffix="W" /> : <div className="lj-card p-8 text-center text-sm text-[var(--lj-muted)]">No completed matches yet</div>}
        </div>
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--lj-muted)]"><Trophy size={14}/> Most Earned</h2>
          {topEarners.length > 0 ? <Table rows={topEarners as [string, Record<string, string | number>][]} valueKey="earned" valueSuffix="XAF" /> : <div className="lj-card p-8 text-center text-sm text-[var(--lj-muted)]">No earnings yet</div>}
        </div>
      </div>
    </div>
  );
}
