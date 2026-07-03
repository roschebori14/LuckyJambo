import type { BalanceCardProps } from "@/types/wallet-ui";

export default function BalanceCard({
  availableBalance,
  lockedBalance,
  totalBalance,
}: BalanceCardProps) {
  return (
    <div className="rounded-xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Wallet Balance</h2>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[var(--lj-muted)]">Available Balance</span>

          <span className="font-semibold">
            {availableBalance.toLocaleString()} XAF
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[var(--lj-muted)]">Locked Balance</span>

          <span className="font-semibold">
            {lockedBalance.toLocaleString()} XAF
          </span>
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Total Balance</span>

            <span className="text-xl font-bold">
              {totalBalance.toLocaleString()} XAF
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
