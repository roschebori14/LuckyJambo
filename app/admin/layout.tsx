import { requireAdmin } from "@/lib/auth/require-admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, Users, Wallet, Swords, AlertTriangle, ArrowLeft, Shield, Flag, TrendingUp } from "lucide-react";

const ADMIN_NAV = [
  { href: "/admin",             icon: LayoutDashboard, label: "Overview" },
  { href: "/admin/withdrawals", icon: Wallet,          label: "Withdrawals" },
  { href: "/admin/users",       icon: Users,           label: "Users" },
  { href: "/admin/matches",     icon: Swords,          label: "Matches" },
  { href: "/admin/reports",     icon: Flag,            label: "Reports" },
  { href: "/admin/revenue",     icon: TrendingUp,      label: "Revenue" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try { await requireAdmin(); } catch { redirect("/dashboard"); }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--lj-navy)" }}>
      {/* Admin sidebar */}
      <aside className="hidden w-56 flex-shrink-0 flex-col md:flex"
        style={{ background: "var(--lj-navy-2)", borderRight: "1px solid rgba(255,200,0,0.15)" }}>
        <div className="flex items-center gap-3 px-5 py-5">
          <Shield size={22} className="text-yellow-400" />
          <div>
            <p className="text-sm font-black text-yellow-400">ADMIN</p>
            <p className="text-[10px] text-[var(--lj-muted)]">Lucky Jambo</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {ADMIN_NAV.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--lj-muted)] transition-all hover:bg-yellow-400/10 hover:text-yellow-300">
              <Icon size={16} /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-3 pb-5">
          <Link href="/dashboard" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-[var(--lj-muted)] hover:text-white">
            <ArrowLeft size={14} /> Back to App
          </Link>
        </div>
      </aside>

      <div className="flex-1">
        {/* Admin header */}
        <div className="flex items-center gap-3 px-6 py-4"
          style={{ background: "var(--lj-navy-2)", borderBottom: "1px solid rgba(255,200,0,0.15)" }}>
          <Image src="/logo.png" alt="LJ" width={28} height={28} />
          <h1 className="text-base font-bold text-white">Lucky Jambo <span className="text-yellow-400">Admin Panel</span></h1>
        </div>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
