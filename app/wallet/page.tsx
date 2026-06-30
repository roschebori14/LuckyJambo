import { requireAuth } from "@/lib/auth/require-auth";
import { WalletService } from "@/lib/wallet/wallet-service";
import { LedgerService } from "@/lib/wallet/ledger-service";
import Link from "next/link";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Lock, TrendingUp } from "lucide-react";

const ENTRY_COLOR: Record<string, string> = {
  deposit: "var(--lj-success)", match_win: "var(--lj-success)", refund: "var(--lj-success)", bonus: "var(--lj-success)",
  withdrawal: "var(--lj-danger)", match_stake: "#f59e0b", match_loss: "var(--lj-danger)", admin_adjustment: "var(--lj-muted)",
};
const SIGN = (type: string) => ["deposit","match_win","refund","bonus","admin_adjustment"].includes(type) ? "+" : "-";

export default async function WalletPage() {
  const user = await requireAuth();
  const [wallet, ledger] = await Promise.all([
    WalletService.getOrCreateWallet(user.id),
    LedgerService.getHistory(user.id, 30),
  ]);

  const totalIn  = ledger.filter(e => ["deposit","match_win","bonus","refund"].includes(e.type)).reduce((s,e) => s+e.amount, 0);
  const totalOut = ledger.filter(e => ["withdrawal","match_stake","match_loss"].includes(e.type)).reduce((s,e) => s+e.amount, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="lj-page-header -mx-4 -mt-4 px-4 pb-5 pt-4 md:-mx-6 md:-mt-6 md:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <Wallet size={24} style={{ color: "var(--lj-cyan)" }} /> Wallet
        </h1>
      </div>

      {/* Balance hero */}
      <div className="relative overflow-hidden rounded-2xl p-6"
        style={{ background: "linear-gradient(135deg, #1a56ff 0%, #0a2080 100%)", border: "1px solid var(--lj-border)" }}>
        <p className="text-sm text-blue-200">Available Balance</p>
        <p className="mt-1 text-4xl font-black text-white">{wallet.available_balance.toLocaleString()} <span className="text-xl text-blue-300">XAF</span></p>
        {wallet.locked_balance > 0 && (
          <p className="mt-2 flex items-center gap-1 text-sm text-blue-300">
            <Lock size={12} /> {wallet.locked_balance.toLocaleString()} XAF locked (matches/withdrawals)
          </p>
        )}
        {/* Actions */}
        <div className="mt-5 flex gap-3">
          <Link href="/wallet/deposit"
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[var(--lj-blue)] hover:bg-blue-50 transition-colors">
            <ArrowDownCircle size={16} /> Deposit
          </Link>
          <Link href="/wallet/withdraw"
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.3)" }}>
            <ArrowUpCircle size={16} /> Withdraw
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="lj-card p-4">
          <div className="flex items-center gap-2 text-xs text-[var(--lj-muted)]"><TrendingUp size={12} /> Total In</div>
          <p className="mt-1 text-lg font-bold" style={{ color: "var(--lj-success)" }}>+{totalIn.toLocaleString()} XAF</p>
        </div>
        <div className="lj-card p-4">
          <div className="flex items-center gap-2 text-xs text-[var(--lj-muted)]"><ArrowUpCircle size={12} /> Total Out</div>
          <p className="mt-1 text-lg font-bold" style={{ color: "var(--lj-danger)" }}>-{totalOut.toLocaleString()} XAF</p>
        </div>
      </div>

      {/* Ledger */}
      <div className="lj-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--lj-border)" }}>
          <h2 className="font-bold text-white">Transaction History</h2>
        </div>
        {ledger.length === 0
          ? <p className="py-10 text-center text-sm text-[var(--lj-muted)]">No transactions yet. Make a deposit to get started.</p>
          : <div className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
              {ledger.map(entry => (
                <div key={entry.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium capitalize text-white">{entry.type.replace(/_/g, " ")}</p>
                    {entry.description && <p className="text-xs text-[var(--lj-muted)] truncate max-w-[200px]">{entry.description}</p>}
                    <p className="text-xs text-[var(--lj-muted)]">{new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                  <p className="font-bold" style={{ color: ENTRY_COLOR[entry.type] ?? "var(--lj-muted)" }}>
                    {SIGN(entry.type)}{entry.amount.toLocaleString()} XAF
                  </p>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
