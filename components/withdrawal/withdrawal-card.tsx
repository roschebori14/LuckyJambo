interface WithdrawalCardProps {
  amount: number;
  status: string;
  provider: string;
  phoneNumber: string;
  createdAt: string;
}

export default function WithdrawalCard({
  amount,
  status,
  provider,
  phoneNumber,
  createdAt,
}: WithdrawalCardProps) {
  return (
    <div className="rounded-xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Withdrawal</h3>

        <span className="rounded-full bg-white/5 px-3 py-1 text-sm">
          {status}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold">{amount.toLocaleString()} XAF</p>

      <p className="mt-2 text-sm text-[var(--lj-muted)]">
        {provider.toUpperCase()} • {phoneNumber}
      </p>

      <p className="mt-1 text-sm text-[var(--lj-muted)]">
        {new Date(createdAt).toLocaleString()}
      </p>
    </div>
  );
}
