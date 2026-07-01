import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./profile-form";
import { User, Trophy, Swords, Wallet } from "lucide-react";

export default async function ProfilePage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const [{ data: profile }, { data: wallet }, { count: totalMatches }, { count: wonMatches }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("wallets").select("available_balance").eq("user_id", user.id).single(),
    supabase.from("match_participants").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("matches").select("*", { count: "exact", head: true }).eq("winner_id", user.id),
  ]);

  const username = profile?.username ?? user.email?.split("@")[0] ?? "Player";
  const winRate = totalMatches ? Math.round(((wonMatches ?? 0) / totalMatches) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="lj-page-header -mx-4 -mt-4 px-4 pb-5 pt-4 md:-mx-6 md:-mt-6 md:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <User size={24} style={{ color: "var(--lj-cyan)" }} /> Profile
        </h1>
      </div>

      {/* Avatar + stats */}
      <div className="lj-card p-6">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-black text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, var(--lj-blue), var(--lj-cyan))" }}>
            {username[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-black text-white">{username}</h2>
            <p className="text-sm text-[var(--lj-muted)]">{user.email}</p>
            {profile?.role === "admin" && (
              <span className="mt-1 inline-block rounded-full bg-yellow-400/20 px-2 py-0.5 text-xs font-bold text-yellow-400">Admin</span>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "Matches", value: totalMatches ?? 0, icon: Swords, color: "var(--lj-blue-2)" },
            { label: "Wins", value: wonMatches ?? 0, icon: Trophy, color: "var(--lj-success)" },
            { label: "Win Rate", value: `${winRate}%`, icon: Trophy, color: "var(--lj-cyan)" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
              <Icon size={16} className="mx-auto mb-1" style={{ color }} />
              <p className="text-lg font-black text-white">{value}</p>
              <p className="text-xs text-[var(--lj-muted)]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Edit form */}
      <div className="lj-card p-5">
        <h2 className="mb-4 font-bold text-white">Edit Profile</h2>
        <ProfileForm
          userId={user.id}
          initialUsername={profile?.username ?? ""}
          email={user.email ?? ""}
        />
      </div>
    </div>
  );
}
