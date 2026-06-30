import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Wallet, Swords, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import AdminAIInsights from "@/components/admin/ai-insights";

export default async function AdminPage() {
  try { await requireAdmin(); } catch { redirect("/dashboard"); }
  const supabase = await createClient();

  const [
    { count: userCount },
    { count: matchCount },
    { count: pendingWithdrawals },
    { data: recentDeposits },
    { data: topWinners },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("matches").select("*", { count: "exact", head: true }),
    supabase.from("withdrawals").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("deposits").select("amount, status, created_at").eq("status", "completed").order("created_at", { ascending: false }).limit(5),
    supabase.from("matches").select("winner_id, profiles!matches_winner_id_fkey(username)").eq("status","completed").not("winner_id","is",null).limit(5),
  ]);

  const totalDeposited = (recentDeposits ?? []).reduce((s, d) => s + (d.amount ?? 0), 0);

  const stats = [
    { label: "Total Users", value: userCount ?? 0, icon: Users, color: "var(--lj-cyan)", href: "/admin/users" },
    { label: "Total Matches", value: matchCount ?? 0, icon: Swords, color: "var(--lj-blue-2)", href: "/admin/matches" },
    { label: "Pending Withdrawals", value: pendingWithdrawals ?? 0, icon: Clock, color: "#f59e0b", href: "/admin/withdrawals" },
    { label: "Recent Deposits", value: `${totalDeposited.toLocaleString()} XAF`, icon: TrendingUp, color: "var(--lj-success)", href: "#" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white">Platform Overview</h2>
        <p className="text-sm text-[var(--lj-muted)]">Live stats — refresh for latest data</p>
      </div>

      {(pendingWithdrawals ?? 0) > 0 && (
        <Link href="/admin/withdrawals"
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-yellow-300 transition-all hover:brightness-110"
          style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <AlertTriangle size={18} />
          {pendingWithdrawals} withdrawal{(pendingWithdrawals ?? 0) > 1 ? "s" : ""} pending your approval
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="lj-card lj-card-hover p-5 block">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[var(--lj-muted)]">{label}</p>
                <p className="mt-1 text-2xl font-black text-white">{value}</p>
              </div>
              <div className="rounded-xl p-2.5" style={{ background: `${color}20` }}>
                <Icon size={20} style={{ color }} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <AdminAIInsights />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent deposits */}
        <div className="lj-card p-5">
          <h3 className="mb-3 font-bold text-white">Recent Completed Deposits</h3>
          {(recentDeposits ?? []).length === 0
            ? <p className="text-sm text-[var(--lj-muted)]">No completed deposits yet.</p>
            : <div className="space-y-2">
                {(recentDeposits ?? []).map((d, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-[var(--lj-muted)]">{new Date(d.created_at).toLocaleDateString()}</span>
                    <span className="font-semibold text-[var(--lj-success)]">+{d.amount?.toLocaleString()} XAF</span>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Quick links */}
        <div className="lj-card p-5">
          <h3 className="mb-3 font-bold text-white">Admin Actions</h3>
          <div className="space-y-2">
            {[
              { href: "/admin/withdrawals", label: "Review Withdrawals", icon: Wallet, urgent: (pendingWithdrawals ?? 0) > 0 },
              { href: "/admin/users", label: "Manage Users", icon: Users, urgent: false },
              { href: "/admin/matches", label: "View All Matches", icon: Swords, urgent: false },
            ].map(({ href, label, icon: Icon, urgent }) => (
              <Link key={href} href={href}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all hover:brightness-110"
                style={{ background: urgent ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${urgent ? "rgba(245,158,11,0.3)" : "var(--lj-border)"}` }}>
                <span className="flex items-center gap-2" style={{ color: urgent ? "#fbbf24" : "var(--lj-text)" }}>
                  <Icon size={15} /> {label}
                </span>
                {urgent && <span className="lj-badge bg-yellow-400/20 text-yellow-400">{pendingWithdrawals} pending</span>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
