type Props = {
  title: string;
  value: string | number;
};

export default function StatsCard({ title, value }: Props) {
  return (
    <div className="rounded-xl border p-4 shadow-sm">
      <h3 className="text-sm text-[var(--lj-muted)]">{title}</h3>

      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
