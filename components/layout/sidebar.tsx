"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Gamepad2, Swords, Wallet, Users, User, Menu, X, Shield } from "lucide-react";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/games",     icon: Gamepad2,        label: "Games" },
  { href: "/matches",   icon: Swords,          label: "Matches" },
  { href: "/wallet",    icon: Wallet,          label: "Wallet" },
  { href: "/friends",   icon: Users,           label: "Friends" },
  { href: "/profile",   icon: User,            label: "Profile" },
];

export default function Sidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="flex items-center justify-between border-b px-4 py-3 md:hidden"
        style={{ background: "var(--lj-navy-2)", borderColor: "var(--lj-border)" }}>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo.png" alt="LJ" width={28} height={28} />
          <span className="text-sm font-black tracking-wide text-white">LUCKY <span style={{color:"var(--lj-cyan)"}}>JAMBO</span></span>
        </Link>
        <button onClick={() => setOpen(v => !v)} className="rounded-lg p-2 text-[var(--lj-muted)] hover:text-white">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Mobile slide-down ── */}
      {open && (
        <div className="border-b shadow-2xl md:hidden" style={{ background: "var(--lj-navy-2)", borderColor: "var(--lj-border)" }}>
          <nav className="flex flex-col gap-1 p-3">
            {NAV.map(({ href, icon: Icon, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link key={href} href={href} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active ? "lj-nav-active text-white" : "text-[var(--lj-muted)] hover:bg-white/5 hover:text-white"}`}>
                  <Icon size={18} /> {label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-yellow-400 hover:bg-yellow-400/10">
                <Shield size={18} /> Admin Panel
              </Link>
            )}
          </nav>
        </div>
      )}

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

      {/* ── Mobile bottom tab bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{ background: "var(--lj-navy-2)", borderTop: "1px solid var(--lj-border)" }}>
        <div className="grid grid-cols-6">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${active ? "text-[var(--lj-cyan)]" : "text-[var(--lj-muted)]"}`}>
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
