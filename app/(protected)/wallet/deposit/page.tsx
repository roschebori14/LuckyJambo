import Link from "next/link";
import { ArrowLeft, ArrowDownCircle } from "lucide-react";
import { requireAuth } from "@/lib/auth/require-auth";
import DepositForm from "@/components/deposit/deposit-form";
import DepositHistory from "@/components/deposit/deposit-history";
import { DepositService } from "@/lib/deposits/deposit-service";

export default async function DepositPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const user = await requireAuth();
  const deposits = await DepositService.getHistory(user.id, 20);
  const { ref } = await searchParams;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="lj-page-header -mx-4 -mt-4 px-4 pb-5 pt-4 md:-mx-6 md:-mt-6 md:px-6">
        <Link
          href="/wallet"
          className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--lj-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} /> Wallet
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <ArrowDownCircle size={22} style={{ color: "var(--lj-cyan)" }} /> Deposit
        </h1>
      </div>

      <DepositForm pendingReference={ref} />

      {deposits.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--lj-muted)]">
            Recent Deposits
          </h2>
          <DepositHistory deposits={deposits} />
        </div>
      )}
    </div>
  );
}
