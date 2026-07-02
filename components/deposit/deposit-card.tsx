interface DepositCardProps {
  amount: number;
  status: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  completed: { color: "var(--lj-success)", bg: "rgba(0, 214, 143, 0.12)" },
  pending: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)" },
  processing: { color: "var(--lj-blue-2)", bg: "rgba(45, 127, 255, 0.12)" },
  failed: { color: "var(--lj-danger)", bg: "rgba(255, 61, 90, 0.12)" },
  cancelled: { color: "var(--lj-muted)", bg: "rgba(107, 127, 168, 0.12)" },
};

export default function DepositCard({
  amount,
  status,
  createdAt,
}: DepositCardProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.cancelled;

  return (
    <div className="lj-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Deposit</h3>

        <span
          className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
          style={{ color: style.color, background: style.bg }}
        >
          {status}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold text-white">{amount.toLocaleString()} XAF</p>

      <p className="mt-2 text-sm text-[var(--lj-muted)]">
        {new Date(createdAt).toLocaleString()}
      </p>
    </div>
  );
}
