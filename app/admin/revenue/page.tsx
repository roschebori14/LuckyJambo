import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TrendingUp, DollarSign, Calendar } from "lucide-react";

export default async function AdminRevenuePage() {
  try { await requireAdmin(); } catch { redirect("/dashboard"); }
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("commission_amount, created_at, status")
    .eq("status", "completed")
    .not("commission_amount", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000);

  const all = matches ?? [];
  const total = all.reduce((s, m) => s + (m.commission_amount ?? 0), 0);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const sumSince = (since: Date) => all
    .filter(m => new Date(m.created_at) >= since)
    .reduce((s, m) => s + (m.commission_amount ?? 0), 0);

  const today = sumSince(todayStart);
  const week = sumSince(weekStart);
  const month = sumSince(monthStart);

  // Group by day for the last 14 days for a simple bar visualization
  const days: { date: string; amount: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayStart.getTime() - i * 86400000);
    const next = new Date(d.getTime() + 86400000);
    const amount = all.filter(m => {
      const t = new Date(m.created_at);
      return t >= d && t < next;
    }).reduce((s, m) => s + (m.commission_amount ?? 0), 0);
    days.push({ date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), amount });
  }
  const maxDay = Math.max(...days.map(d => d.amount), 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white">Platform Revenue</h2>
        <p className="text-sm text-[var(--lj-muted)]">5% commission earned on completed matches</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Today", value: today, icon: Calendar },
          { label: "This Week", value: week, icon: Calendar },
          { label: "This Month", value: month, icon: TrendingUp },
          { label: "All Time", value: total, icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="lj-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--lj-muted)]">{label}</p>
              <Icon size={14} style={{ color: "var(--lj-success)" }} />
            </div>
            <p className="mt-1 text-xl font-black" style={{ color: "var(--lj-success)" }}>
              {value.toLocaleString()} <span className="text-xs text-[var(--lj-muted)]">XAF</span>
            </p>
          </div>
        ))}
      </div>

      <div className="lj-card p-5">
        <h3 className="mb-4 font-bold text-white">Last 14 Days</h3>
        <div className="flex items-end gap-1.5" style={{ height: 160 }}>
          {days.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="w-full rounded-t-md transition-all"
                style={{
                  height: `${Math.max((d.amount / maxDay) * 130, 2)}px`,
                  background: "linear-gradient(180deg, var(--lj-cyan), var(--lj-blue))",
                }}
                title={`${d.date}: ${d.amount.toLocaleString()} XAF`}
              />
              <span className="text-[8px] text-[var(--lj-muted)] -rotate-45 origin-top-left whitespace-nowrap">{d.date}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lj-card p-5">
        <p className="text-sm text-[var(--lj-muted)]">
          Based on {all.length} completed matches. Commission is recorded at settlement time
          (<code className="text-[var(--lj-cyan)]">matches.commission_amount</code>),
          set by the platform fee in <code className="text-[var(--lj-cyan)]">settings.platform_fee_percent</code>.
        </p>
      </div>
    </div>
  );
}
