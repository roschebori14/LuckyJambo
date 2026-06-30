import WithdrawalCard from "./withdrawal-card";

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  provider: string;
  phone_number: string;
  created_at: string;
}

interface WithdrawalHistoryProps {
  withdrawals: Withdrawal[];
}

export default function WithdrawalHistory({
  withdrawals,
}: WithdrawalHistoryProps) {
  return (
    <div className="space-y-4">
      {withdrawals.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-center">
          No withdrawals found
        </div>
      ) : (
        withdrawals.map((withdrawal) => (
          <WithdrawalCard
            key={withdrawal.id}
            amount={withdrawal.amount}
            status={withdrawal.status}
            provider={withdrawal.provider}
            phoneNumber={withdrawal.phone_number}
            createdAt={withdrawal.created_at}
          />
        ))
      )}
    </div>
  );
}
