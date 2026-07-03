import { WalletSummaryProps } from "@/types/wallet-ui";

export default function WalletSummary({
  totalDeposits,
  totalWithdrawals,
  totalWinnings,
}: WalletSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-4">
        <h3 className="text-sm text-[var(--lj-muted)]">Total Deposits</h3>

        <p className="text-2xl font-bold">{totalDeposits} XAF</p>
      </div>

      <div className="rounded-lg border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-4">
        <h3 className="text-sm text-[var(--lj-muted)]">Total Withdrawals</h3>

        <p className="text-2xl font-bold">{totalWithdrawals} XAF</p>
      </div>

      <div className="rounded-lg border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-4">
        <h3 className="text-sm text-[var(--lj-muted)]">Total Winnings</h3>

        <p className="text-2xl font-bold">{totalWinnings} XAF</p>
      </div>
    </div>
  );
}
