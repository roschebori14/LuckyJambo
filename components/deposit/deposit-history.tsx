import DepositCard from "./deposit-card";

interface Deposit {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface DepositHistoryProps {
  deposits: Deposit[];
}

export default function DepositHistory({
  deposits,
}: DepositHistoryProps) {
  return (
    <div className="space-y-4">
      {deposits.length === 0 ? (
        <div className="lj-card p-6 text-center text-sm text-[var(--lj-muted)]">
          No deposits found
        </div>
      ) : (
        deposits.map((deposit) => (
          <DepositCard
            key={deposit.id}
            amount={deposit.amount}
            status={deposit.status}
            createdAt={deposit.created_at}
          />
        ))
      )}
    </div>
  );
}