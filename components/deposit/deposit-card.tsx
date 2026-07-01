interface DepositCardProps {
  amount: number;
  status: string;
  createdAt: string;
}

const STATUS_CLASSES: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function DepositCard({
  amount,
  status,
  createdAt,
}: DepositCardProps) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Deposit</h3>

        <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-600"}`}>
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
