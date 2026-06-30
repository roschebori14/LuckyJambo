import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WithdrawalActions from "./withdrawal-actions";

export default async function AdminWithdrawalsPage() {
  try { await requireAdmin(); } catch { redirect("/dashboard"); }
  const supabase = await createClient();

  const { data: withdrawals } = await supabase
    .from("withdrawals")
    .select("*, profiles(username, id)")
    .order("created_at", { ascending: false })
    .limit(50);

  const pending = (withdrawals ?? []).filter(w => w.status === "pending");
  const processed = (withdrawals ?? []).filter(w => w.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white">Withdrawal Requests</h2>
        <p className="text-sm text-[var(--lj-muted)]">{pending.length} pending approval</p>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="lj-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--lj-border)" }}>
            <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
            <h3 className="font-bold text-yellow-400">Pending ({pending.length})</h3>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
            {pending.map(w => (
              <div key={w.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{(w.profiles as {username:string}|null)?.username ?? "User"}</p>
                  <p className="text-xs text-[var(--lj-muted)]">{w.provider?.toUpperCase()} · {w.account_number}</p>
                  <p className="text-xs text-[var(--lj-muted)]">{w.transaction_reference}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-white">{w.amount?.toLocaleString()} XAF</p>
                  <p className="text-xs text-[var(--lj-muted)]">{new Date(w.created_at).toLocaleString()}</p>
                </div>
                <WithdrawalActions withdrawalId={w.id} userId={(w.profiles as {id:string}|null)?.id ?? ""} amount={w.amount} />
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && (
        <div className="lj-card flex items-center justify-center py-12 text-center">
          <div>
            <p className="text-4xl mb-2">✅</p>
            <p className="font-semibold text-white">All caught up!</p>
            <p className="text-sm text-[var(--lj-muted)]">No pending withdrawals right now.</p>
          </div>
        </div>
      )}

      {/* History */}
      {processed.length > 0 && (
        <div className="lj-card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--lj-border)" }}>
            <h3 className="font-bold text-white">History</h3>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
            {processed.map(w => (
              <div key={w.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="text-white">{(w.profiles as {username:string}|null)?.username}</p>
                  <p className="text-xs text-[var(--lj-muted)]">{w.provider?.toUpperCase()} · {w.account_number}</p>
                </div>
                <p className="font-semibold text-white">{w.amount?.toLocaleString()} XAF</p>
                <span className={`lj-badge ${
                  w.status === "completed" ? "bg-green-500/20 text-green-400" :
                  w.status === "rejected"  ? "bg-red-500/20 text-red-400" :
                  "bg-gray-500/20 text-gray-400"}`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
