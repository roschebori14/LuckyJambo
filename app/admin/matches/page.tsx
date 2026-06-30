import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminMatchesPage() {
  try { await requireAdmin(); } catch { redirect("/dashboard"); }
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, status, stake_amount, total_pot, created_at, games(name), profiles!matches_creator_id_fkey(username)")
    .order("created_at", { ascending: false })
    .limit(50);

  const byStatus = (s: string) => (matches ?? []).filter(m => m.status === s).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-white">Matches</h2>
        <p className="text-sm text-[var(--lj-muted)]">{matches?.length ?? 0} recent matches</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Waiting", count: byStatus("waiting"), color: "#f59e0b" },
          { label: "Active", count: byStatus("active"), color: "var(--lj-success)" },
          { label: "Completed", count: byStatus("completed"), color: "var(--lj-blue-2)" },
          { label: "Cancelled", count: byStatus("cancelled"), color: "var(--lj-danger)" },
        ].map(({ label, count, color }) => (
          <div key={label} className="lj-card p-4 text-center">
            <p className="text-2xl font-black" style={{ color }}>{count}</p>
            <p className="text-xs text-[var(--lj-muted)]">{label}</p>
          </div>
        ))}
      </div>

      <div className="lj-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--lj-border)", background: "rgba(255,255,255,0.02)" }}>
                {["Game", "Creator", "Stake", "Pot", "Status", "Date"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--lj-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
              {(matches ?? []).map(m => (
                <tr key={m.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white">{((m.games as unknown) as {name:string}|null)?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--lj-muted)]">{((m.profiles as unknown) as {username:string}|null)?.username ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-white">{m.stake_amount?.toLocaleString()} XAF</td>
                  <td className="px-4 py-3 text-[var(--lj-success)]">{m.total_pot?.toLocaleString()} XAF</td>
                  <td className="px-4 py-3">
                    <span className={`lj-badge ${
                      m.status === "active"    ? "bg-green-500/20 text-green-400" :
                      m.status === "waiting"   ? "bg-yellow-500/20 text-yellow-400" :
                      m.status === "completed" ? "bg-blue-500/20 text-blue-300" :
                      "bg-red-500/20 text-red-400"}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--lj-muted)]">{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
