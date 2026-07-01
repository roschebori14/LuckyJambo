import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ReportActions from "./report-actions";

export default async function AdminReportsPage() {
  try { await requireAdmin(); } catch { redirect("/dashboard"); }
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("match_reports")
    .select("*, profiles!match_reports_reporter_id_fkey(username), matches(stake_amount, status, games(name))")
    .order("created_at", { ascending: false })
    .limit(50);

  const pending = (reports ?? []).filter(r => r.status === "pending");
  const resolved = (reports ?? []).filter(r => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white">Match Reports</h2>
        <p className="text-sm text-[var(--lj-muted)]">{pending.length} awaiting review</p>
      </div>

      {pending.length === 0 ? (
        <div className="lj-card flex items-center justify-center py-12 text-center">
          <div>
            <p className="text-4xl mb-2">✅</p>
            <p className="font-semibold text-white">No open reports</p>
          </div>
        </div>
      ) : (
        <div className="lj-card overflow-hidden">
          <div className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
            {pending.map(r => (
              <div key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-semibold text-white">
                    {((r.matches as unknown) as { games: { name: string } } | null)?.games?.name ?? "Match"}
                    {" · "}
                    {((r.matches as unknown) as { stake_amount: number } | null)?.stake_amount?.toLocaleString()} XAF
                  </p>
                  <p className="text-xs text-[var(--lj-muted)]">
                    Reported by {((r.profiles as unknown) as { username: string } | null)?.username}
                  </p>
                  <p className="mt-2 text-sm text-[var(--lj-text)]">{r.reason}</p>
                  <p className="mt-1 text-xs text-[var(--lj-muted)]">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <ReportActions reportId={r.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div className="lj-card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--lj-border)" }}>
            <h3 className="font-bold text-white">Resolved</h3>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
            {resolved.map(r => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <p className="text-[var(--lj-muted)] truncate max-w-md">{r.reason}</p>
                <span className={`lj-badge ${r.status === "resolved_refund" ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
                  {r.status === "resolved_refund" ? "refunded" : "dismissed"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
