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
        <Link href="/wallet" className="text-sm text-gray-500 hover:text-gray-800">← Wallet</Link>
        <h1 className="text-xl font-extrabold text-gray-900">Withdraw</h1>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Available</p>
          <p className="text-xl font-extrabold text-gray-900">
            {wallet.available_balance.toLocaleString()}<span className="ml-1 text-sm font-medium text-gray-400">XAF</span>
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Locked</p>
          <p className="text-xl font-extrabold text-amber-600">
            {wallet.locked_balance.toLocaleString()}<span className="ml-1 text-sm font-medium text-gray-400">XAF</span>
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
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-3">
            <h2 className="font-bold text-gray-900">Withdrawal History</h2>
          </div>
          <div className="divide-y">
            {withdrawals.slice(0, 10).map(w => (
              <div key={w.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{w.amount.toLocaleString()} XAF</p>
                  <p className="text-xs text-gray-400">{w.provider?.toUpperCase()} · {w.account_number}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  w.status === "completed" ? "bg-green-100 text-green-700" :
                  w.status === "pending"   ? "bg-yellow-100 text-yellow-700" :
                  w.status === "rejected"  ? "bg-red-100 text-red-600" :
                  "bg-gray-100 text-gray-600"
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
