import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-auth";
import DepositForm from "@/components/deposit/deposit-form";
import DepositHistory from "@/components/deposit/deposit-history";
import { DepositService } from "@/lib/deposits/deposit-service";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";

interface Props { searchParams: Promise<{ status?: string }> }

export default async function DepositPage({ searchParams }: Props) {
  const user = await requireAuth();
  const { status } = await searchParams;
  const deposits = await DepositService.getHistory(user.id, 20);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/wallet" className="flex items-center gap-1 text-sm text-[var(--lj-muted)] hover:text-white">
          <ArrowLeft size={14} /> Wallet
        </Link>
        <h1 className="text-xl font-extrabold text-white">Deposit</h1>
      </div>

      {status === "returned" && (
        <div className="lj-card flex items-center gap-3 px-4 py-3 text-sm font-semibold"
          style={{ borderColor: "rgba(255,215,0,0.3)", background: "rgba(255,215,0,0.05)" }}>
          <CheckCircle size={16} style={{ color: "var(--lj-gold)" }} />
          <span className="text-yellow-300">Payment submitted — balance updates in seconds once confirmed.</span>
        </div>
      )}

      <DepositForm />

      {deposits.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--lj-muted)]">Recent Deposits</h2>
          <DepositHistory deposits={deposits} />
        </div>
      )}
    </div>
  );
}
