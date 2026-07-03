import Link from "next/link";

export default function WithdrawButton() {
  return (
    <Link
      href="/wallet/withdraw"
      className="flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-[var(--lj-card-2)] px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-500/10"
    >
      ↑ Withdraw
    </Link>
  );
}
