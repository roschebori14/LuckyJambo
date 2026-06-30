import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { WalletService } from "@/lib/wallet/wallet-service";
import { LedgerService } from "@/lib/wallet/ledger-service";
import Link from "next/link";
import Image from "next/image";
import { Gamepad2, Swords, TrendingUp, Wallet, ArrowRight, Trophy, Clock } from "lucide-react";

export default async function DashboardPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const [wallet, ledger] = await Promise.all([
    WalletService.getOrCreateWallet(user.id),
    LedgerService.getHistory(user.id, 5),
  ]);

  const { data: recentMatches } = await supabase
    .from("matches")
    .select("id, status, stake_amount, created_at, games(name)")
    .or(`creator_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(4);

  const { count: totalMatches } = await supabase
    .from("match_participants").select("*", { count: "exact", head: true }).eq("user_id", user.id);

  const { count: wonMatches } = await supabase
    .from("matches").select("*", { count: "exact", head: true }).eq("winner_id", user.id);

  const username = user.user_metadata?.username ?? user.email?.split("@")[0] ?? "Player";
  const winRate = totalMatches ? Math.round(((wonMatches ?? 0) / totalMatches) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-2xl p-6"
        style={{ background: "linear-gradient(135deg, var(--lj-blue) 0%, #0a1f6e 100%)", border: "1px solid var(--lj-border)" }}>
        <div className="absolute right-0 top-0 opacity-10">
          <Image src="/logo-banner.png" alt="" width={300} height={120} className="object-cover" />
        </div>
        <p className="text-sm text-blue-200">Welcome back,</p>
        <h1 className="mt-1 text-2xl font-black text-white">{username} 👋</h1>
        <p className="mt-1 text-sm text-blue-200">Ready to compete? Your arena awaits.</p>
        <Link href="/games"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[var(--lj-blue)] hover:bg-blue-50 transition-colors">
          <Gamepad2 size={16} /> Play Now <ArrowRight size={14} />
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Balance", value: `${wallet.available_balance.toLocaleString()} XAF`, icon: Wallet, color: "var(--lj-cyan)" },
          { label: "Locked", value: `${wallet.locked_balance.toLocaleString()} XAF`, icon: Clock, color: "#f59e0b" },
          { label: "Matches", value: totalMatches ?? 0, icon: Swords, color: "var(--lj-blue-2)" },
          { label: "Win Rate", value: `${winRate}%`, icon: Trophy, color: "var(--lj-success)" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="lj-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-[var(--lj-muted)]">{label}</p>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-lg font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Quick actions */}
        <div className="lj-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-white"><TrendingUp size={16} style={{color:"var(--lj-cyan)"}} /> Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/games", label: "New Game", icon: Gamepad2, bg: "var(--lj-blue)" },
              { href: "/matches", label: "My Matches", icon: Swords, bg: "#6d28d9" },
              { href: "/wallet/deposit", label: "Deposit", icon: Wallet, bg: "var(--lj-success)" },
              { href: "/wallet/withdraw", label: "Withdraw", icon: ArrowRight, bg: "var(--lj-danger)" },
            ].map(({ href, label, icon: Icon, bg }) => (
              <Link key={href} href={href}
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
                style={{ background: bg }}>
                <Icon size={16} /> {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="lj-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-white"><Clock size={16} style={{color:"var(--lj-cyan)"}} /> Recent Activity</h2>
          {ledger.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--lj-muted)]">No transactions yet — make your first deposit!</p>
          ) : (
            <div className="space-y-2">
              {ledger.map(entry => (
                <div key={entry.id} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-[var(--lj-muted)]">{entry.type.replace(/_/g, " ")}</span>
                  <span className={`font-semibold ${["deposit","match_win","refund","bonus"].includes(entry.type) ? "text-[var(--lj-success)]" : "text-[var(--lj-danger)]"}`}>
                    {["deposit","match_win","refund","bonus"].includes(entry.type) ? "+" : "-"}{entry.amount.toLocaleString()} XAF
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent matches */}
      {recentMatches && recentMatches.length > 0 && (
        <div className="lj-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-white"><Swords size={16} style={{color:"var(--lj-cyan)"}} /> Recent Matches</h2>
            <Link href="/matches" className="text-xs text-[var(--lj-blue-2)] hover:text-[var(--lj-cyan)]">View all</Link>
          </div>
          <div className="space-y-2">
            {recentMatches.map(m => (
              <div key={m.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <span className="text-white">{((m.games as unknown) as {name:string}|null)?.name ?? "Match"}</span>
                <span className="text-[var(--lj-muted)]">{m.stake_amount?.toLocaleString()} XAF</span>
                <span className={`lj-badge ${
                  m.status === "active" ? "bg-green-500/20 text-green-400" :
                  m.status === "waiting" ? "bg-yellow-500/20 text-yellow-400" :
                  m.status === "completed" ? "bg-blue-500/20 text-blue-300" :
                  "bg-red-500/20 text-red-400"}`}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
