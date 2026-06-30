interface DepositCardProps {
  amount: number;
  status: string;
  createdAt: string;
}

export default function DepositCard({
  amount,
  status,
  createdAt,
}: DepositCardProps) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Deposit</h3>

        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
          {status}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold">{amount.toLocaleString()} XAF</p>

      <p className="mt-2 text-sm text-gray-500">
        {new Date(createdAt).toLocaleString()}
      </p>
    </div>
  );
}
