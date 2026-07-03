import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Withdrawals are auto-processed via Fapshi in app/api/withdrawals/create/route.ts
// (locked -> completed/failed, synchronously, no admin step). This page is a
// read-only ledger for support/ops: check payout status, Fapshi transaction
// id for reconciliation, and failure reasons for failed payouts. A "pending"
// row here means the create request is still mid-flight or crashed before
// resolving - it is not something to click "approve" on.
export default async function AdminWithdrawalsPage() {
  try { await requireAdmin(); } catch { redirect("/dashboard"); }
  const supabase = await createClient();

  const { data: withdrawals } = await supabase
    .from("withdrawals")
    .select("*, profiles(username, id)")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = withdrawals ?? [];
  const inFlightCount = rows.filter(w => w.status === "pending" || w.status === "processing").length;

  const badgeClass = (status: string) =>
    status === "completed" ? "bg-green-500/20 text-green-400" :
    status === "failed"    ? "bg-red-500/20 text-red-400" :
    status === "rejected"  ? "bg-red-500/20 text-red-400" :
    status === "processing"? "bg-blue-500/20 text-blue-400" :
    "bg-yellow-500/20 text-yellow-400";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white">Withdrawals</h2>
        <p className="text-sm text-[var(--lj-muted)]">
          Auto-processed via Fapshi on request.
          {inFlightCount > 0 && ` ${inFlightCount} awaiting Fapshi confirmation.`}
        </p>
      </div>

      {rows.length === 0 && (
        <div className="lj-card flex items-center justify-center py-12 text-center">
          <div>
            <p className="text-4xl mb-2">💤</p>
            <p className="font-semibold text-white">No withdrawals yet</p>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="lj-card overflow-hidden">
          <div className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
            {rows.map(w => (
              <div key={w.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">
                    {(w.profiles as { username: string } | null)?.username ?? "User"}
                  </p>
                  <p className="text-xs text-[var(--lj-muted)]">
                    {w.provider?.toUpperCase()} · {w.account_number}
                  </p>
                  <p className="text-xs text-[var(--lj-muted)]">
                    {w.transaction_reference}
                    {w.financial_trans_id ? ` · Fapshi: ${w.financial_trans_id}` : ""}
                  </p>
                  {w.status === "failed" && w.failure_reason && (
                    <p className="text-xs text-red-400 mt-1">{w.failure_reason}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-white">{w.amount?.toLocaleString()} XAF</p>
                  <p className="text-xs text-[var(--lj-muted)]">{new Date(w.created_at).toLocaleString()}</p>
                </div>
                <span className={`lj-badge ${badgeClass(w.status)}`}>{w.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
