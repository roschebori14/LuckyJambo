import { requireAuth } from "@/lib/auth/require-auth";
import { WalletService } from "@/lib/wallet/wallet-service";
import WithdrawalForm from "@/components/withdrawal/withdrawal-form";
import { WithdrawalService } from "@/lib/withdrawals/withdrawal-service";
import Link from "next/link";

export default async function WithdrawPage() {
  const user = await requireAuth();
  const wallet = await WalletService.getOrCreateWallet(user.id);
  const withdrawals = await WithdrawalService.getWithdrawals(user.id);

  const pending = withdrawals.filter(w => w.status === "pending");

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/wallet" className="text-sm text-[var(--lj-muted)] hover:text-white">← Wallet</Link>
        <h1 className="text-xl font-extrabold text-white">Withdraw</h1>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-4 shadow-sm">
          <p className="text-xs text-[var(--lj-muted)]">Available</p>
          <p className="text-xl font-extrabold text-white">
            {wallet.available_balance.toLocaleString()}<span className="ml-1 text-sm font-medium text-[var(--lj-muted)]">XAF</span>
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-4 shadow-sm">
          <p className="text-xs text-[var(--lj-muted)]">Locked</p>
          <p className="text-xl font-extrabold text-amber-600">
            {wallet.locked_balance.toLocaleString()}<span className="ml-1 text-sm font-medium text-[var(--lj-muted)]">XAF</span>
          </p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          You have {pending.length} pending withdrawal{pending.length > 1 ? "s" : ""} awaiting admin approval.
        </div>
      )}

      <WithdrawalForm availableBalance={wallet.available_balance} />

      {/* History */}
      {withdrawals.length > 0 && (
        <div className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] shadow-sm">
          <div className="border-b px-5 py-3">
            <h2 className="font-bold text-white">Withdrawal History</h2>
          </div>
          <div className="divide-y">
            {withdrawals.slice(0, 10).map(w => (
              <div key={w.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-white">{w.amount.toLocaleString()} XAF</p>
                  <p className="text-xs text-[var(--lj-muted)]">{w.provider?.toUpperCase()} · {w.account_number}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  w.status === "completed" ? "bg-green-100 text-green-300" :
                  w.status === "pending"   ? "bg-yellow-100 text-yellow-300" :
                  w.status === "rejected"  ? "bg-red-100 text-red-600" :
                  "bg-white/5 text-[var(--lj-muted)]"
                }`}>
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
