"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Gamepad2, Swords, Wallet, Users, User, Shield, Trophy, MessageCircle } from "lucide-react";

const NAV = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard" },
  { href: "/games",       icon: Gamepad2,        label: "Games" },
  { href: "/matches",     icon: Swords,          label: "Matches" },
  { href: "/leaderboard", icon: Trophy,          label: "Leaderboard" },
  { href: "/wallet",      icon: Wallet,          label: "Wallet" },
  { href: "/friends",     icon: Users,           label: "Friends" },
  { href: "/messages",    icon: MessageCircle,   label: "Messages" },
  { href: "/profile",     icon: User,            label: "Profile" },
];

export default function Sidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 md:hidden"
        style={{ background: "var(--lj-navy-2)", borderColor: "var(--lj-border)" }}>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo.png" alt="LJ" width={28} height={28} />
          <span className="text-sm font-black tracking-wide text-white">LUCKY <span style={{color:"var(--lj-cyan)"}}>JAMBO</span></span>
        </Link>
        {isAdmin && (
          <Link href="/admin" className="rounded-lg p-2 text-yellow-400 hover:bg-yellow-400/10">
            <Shield size={20} />
          </Link>
        )}
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-8 md:hidden"
        style={{
          background: "var(--lj-navy-2)",
          borderTop: "1px solid var(--lj-border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                active ? "text-white" : "text-[var(--lj-muted)]"
              }`}
            >
              <Icon size={20} style={active ? { color: "var(--lj-cyan)" } : undefined} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden min-h-screen w-60 flex-shrink-0 flex-col md:flex"
        style={{ background: "var(--lj-navy-2)", borderRight: "1px solid var(--lj-border)" }}>
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 px-5 py-6">
          <Image src="/logo.png" alt="Lucky Jambo" width={38} height={38} className="drop-shadow-lg" />
          <div>
            <p className="text-base font-black tracking-wide text-white leading-none">LUCKY <span style={{color:"var(--lj-cyan)"}}>JAMBO</span></p>
            <p className="text-[9px] tracking-[0.25em] text-[var(--lj-muted)] uppercase">Play · Compete · Win</p>
          </div>
        </Link>

        <nav className="flex flex-col gap-1 px-3 pb-4">
          <p className="mb-1 mt-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--lj-muted)]">Menu</p>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active ? "lj-nav-active text-white" : "text-[var(--lj-muted)] hover:bg-white/5 hover:text-white"}`}>
                <Icon size={18} /> {label}
              </Link>
            );
          })}
          {isAdmin && (
            <>
              <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--lj-muted)]">Admin</p>
              <Link href="/admin"
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${pathname.startsWith("/admin") ? "lj-nav-active text-yellow-300" : "text-yellow-400/70 hover:bg-yellow-400/10 hover:text-yellow-300"}`}>
                <Shield size={18} /> Admin Panel
              </Link>
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
