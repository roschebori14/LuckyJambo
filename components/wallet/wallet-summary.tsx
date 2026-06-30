import { WalletSummaryProps } from "@/types/wallet-ui";

export default function WalletSummary({
  totalDeposits,
  totalWithdrawals,
  totalWinnings,
}: WalletSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-sm text-gray-500">Total Deposits</h3>

        <p className="text-2xl font-bold">{totalDeposits} XAF</p>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-sm text-gray-500">Total Withdrawals</h3>

        <p className="text-2xl font-bold">{totalWithdrawals} XAF</p>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-sm text-gray-500">Total Winnings</h3>

        <p className="text-2xl font-bold">{totalWinnings} XAF</p>
      </div>
    </div>
  );
}
