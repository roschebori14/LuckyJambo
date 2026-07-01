import { requireAuth } from "@/lib/auth/require-auth";
import { WalletService } from "@/lib/wallet/wallet-service";
import { WithdrawalService } from "@/lib/withdrawals/withdrawal-service";
import { createAdminClient } from "@/lib/supabase/admin";
import WithdrawalForm from "@/components/withdrawal/withdrawal-form";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";

export default async function WithdrawPage() {
  const user = await requireAuth();
  const admin = createAdminClient();

  const [wallet, withdrawals, { data: settings }] = await Promise.all([
    WalletService.getOrCreateWallet(user.id),
    WithdrawalService.getWithdrawals(user.id),
    admin.from("settings").select("key, value").in("key", ["auto_withdrawal_enabled", "auto_withdrawal_max_amount"]),
  ]);

  const settingsMap = Object.fromEntries((settings ?? []).map(r => [r.key, r.value]));
  const autoEnabled = settingsMap.auto_withdrawal_enabled === "true";
  const autoMax = autoEnabled ? Number(settingsMap.auto_withdrawal_max_amount ?? 0) : 0;

  const pending = withdrawals.filter(w => w.status === "pending");

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/wallet" className="flex items-center gap-1 text-sm text-[var(--lj-muted)] hover:text-white">
          <ArrowLeft size={14}/> Wallet
        </Link>
        <h1 className="text-xl font-extrabold text-white">Withdraw</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="lj-card p-4">
          <p className="text-xs text-[var(--lj-muted)]">Available</p>
          <p className="text-xl font-black text-white">{wallet.available_balance.toLocaleString()} <span className="text-sm text-[var(--lj-muted)]">XAF</span></p>
        </div>
        <div className="lj-card p-4">
          <p className="text-xs text-[var(--lj-muted)]">Locked</p>
          <p className="text-xl font-black text-yellow-400">{wallet.locked_balance.toLocaleString()} <span className="text-sm text-[var(--lj-muted)]">XAF</span></p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <Clock size={16} className="text-yellow-400 flex-shrink-0"/>
          <p className="text-yellow-300">{pending.length} pending withdrawal{pending.length > 1 ? "s" : ""} awaiting processing</p>
        </div>
      )}

      <WithdrawalForm availableBalance={wallet.available_balance} autoMax={autoMax} />

      {withdrawals.length > 0 && (
        <div className="lj-card overflow-hidden">
          <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--lj-border)" }}>
            <h2 className="font-bold text-white">History</h2>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
            {withdrawals.slice(0, 10).map(w => (
              <div key={w.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-white">{w.amount.toLocaleString()} XAF</p>
                  <p className="text-xs text-[var(--lj-muted)]">{w.provider?.toUpperCase()} · {w.account_number}</p>
                </div>
                <span className={`lj-badge ${
                  w.status === "completed" ? "bg-green-500/20 text-green-400" :
                  w.status === "pending"   ? "bg-yellow-500/20 text-yellow-400" :
                  w.status === "failed"    ? "bg-red-500/20 text-red-400" :
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
