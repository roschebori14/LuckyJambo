import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WalletService } from "@/lib/wallet/wallet-service";
import { Bell, ChevronDown } from "lucide-react";

export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let balance = 0;
  let username = "Player";
  let isAdmin = false;

  if (user) {
    try {
      const wallet = await WalletService.getOrCreateWallet(user.id);
      balance = wallet.available_balance;
    } catch {}
    username = user.user_metadata?.username ?? user.email?.split("@")[0] ?? "Player";
    try {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      isAdmin = profile?.role === "admin";
    } catch {}
  }

  return (
    <header className="hidden items-center justify-between px-6 py-3 md:flex"
      style={{ background: "var(--lj-navy-2)", borderBottom: "1px solid var(--lj-border)" }}>
      <p className="text-sm text-[var(--lj-muted)]">
        Welcome back, <span className="font-semibold text-white">{username}</span>
        {isAdmin && <span className="ml-2 rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400 uppercase">Admin</span>}
      </p>

      <div className="flex items-center gap-3">
        {/* Balance */}
        <Link href="/wallet"
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg, var(--lj-blue) 0%, var(--lj-cyan) 100%)", boxShadow: "0 4px 12px var(--lj-glow)" }}>
          <Image src="/logo.png" alt="" width={16} height={16} />
          {balance.toLocaleString()} XAF
        </Link>

        {/* Notifications */}
        <Link href="/notifications" className="relative rounded-xl p-2.5 text-[var(--lj-muted)] transition-colors hover:bg-white/5 hover:text-white"
          style={{ border: "1px solid var(--lj-border)" }}>
          <Bell size={18} />
        </Link>

        {/* Avatar */}
        <div className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-white/5"
          style={{ border: "1px solid var(--lj-border)" }}>
          <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white"
            style={{ background: "linear-gradient(135deg, var(--lj-blue) 0%, var(--lj-cyan) 100%)" }}>
            {username[0]?.toUpperCase()}
          </div>
          <span className="text-sm font-medium text-white">{username}</span>
          <ChevronDown size={14} className="text-[var(--lj-muted)]" />
        </div>
      </div>
    </header>
  );
}
