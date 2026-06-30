import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Shield, User } from "lucide-react";

export default async function AdminUsersPage() {
  try { await requireAdmin(); } catch { redirect("/dashboard"); }
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("id, username, role, created_at, wallets(available_balance, locked_balance)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-white">Users</h2>
        <p className="text-sm text-[var(--lj-muted)]">{users?.length ?? 0} total registered players</p>
      </div>

      <div className="lj-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--lj-border)", background: "rgba(255,255,255,0.02)" }}>
                {["Player", "Role", "Balance", "Locked", "Joined"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--lj-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
              {(users ?? []).map(u => {
                const wallet = Array.isArray(u.wallets) ? u.wallets[0] : u.wallets;
                return (
                  <tr key={u.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: "linear-gradient(135deg, var(--lj-blue), var(--lj-cyan))" }}>
                          {(u.username ?? "?")[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-white">{u.username ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`lj-badge ${u.role === "admin" ? "bg-yellow-400/20 text-yellow-400" : "bg-blue-500/20 text-blue-300"}`}>
                        {u.role === "admin" ? <><Shield size={10} /> admin</> : <><User size={10} /> player</>}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--lj-success)]">
                      {(wallet?.available_balance ?? 0).toLocaleString()} XAF
                    </td>
                    <td className="px-4 py-3 text-[var(--lj-muted)]">
                      {(wallet?.locked_balance ?? 0).toLocaleString()} XAF
                    </td>
                    <td className="px-4 py-3 text-[var(--lj-muted)]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
