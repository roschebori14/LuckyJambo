import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-auth";
import DepositForm from "@/components/deposit/deposit-form";
import DepositHistory from "@/components/deposit/deposit-history";
import { DepositService } from "@/lib/deposits/deposit-service";

export default async function DepositPage() {
  const user = await requireAuth();
  const deposits = await DepositService.getHistory(user.id, 20);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/wallet" className="text-sm text-gray-500 hover:text-gray-800">← Wallet</Link>
        <h1 className="text-xl font-extrabold text-gray-900">Deposit</h1>
      </div>
      <DepositForm />
      {deposits.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Recent Deposits</h2>
          <DepositHistory deposits={deposits} />
        </div>
      )}
    </div>
  );
}
