interface Deposit { id: string; amount: number; status: string; created_at: string }

const STATUS_COLOR: Record<string, string> = {
  completed: "bg-green-500/20 text-green-400",
  pending:   "bg-yellow-500/20 text-yellow-400",
  failed:    "bg-red-500/20 text-red-400",
  expired:   "bg-gray-500/20 text-gray-400",
};

export default function DepositHistory({ deposits }: { deposits: Deposit[] }) {
  return (
    <div className="lj-card overflow-hidden">
      <div className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
        {deposits.map(d => (
          <div key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
            <div>
              <p className="font-semibold text-white">{d.amount.toLocaleString()} XAF</p>
              <p className="text-xs text-[var(--lj-muted)]">{new Date(d.created_at).toLocaleString()}</p>
            </div>
            <span className={`lj-badge ${STATUS_COLOR[d.status] ?? "bg-gray-500/20 text-gray-400"}`}>{d.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
