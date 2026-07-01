"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Save, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  userId: string;
  initialUsername: string;
  email: string;
}

export default function ProfileForm({ userId, initialUsername, email }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function save() {
    if (username.length < 3) { setMsg("❌ Username too short"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setMsg("❌ Letters, numbers and underscores only"); return; }
    setSaving(true); setMsg("");
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ username }).eq("id", userId);
    setSaving(false);
    setMsg(error ? "❌ " + error.message : "✅ Profile updated!");
    if (!error) router.refresh();
  }

  async function logout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="space-y-4">
      {msg && <p className={`text-sm ${msg.startsWith("✅") ? "text-[var(--lj-success)]" : "text-red-400"}`}>{msg}</p>}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} className="lj-input" placeholder="your_username" />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">Email</label>
        <input value={email} disabled className="lj-input opacity-50 cursor-not-allowed" />
        <p className="mt-1 text-xs text-[var(--lj-muted)]">Email cannot be changed here</p>
      </div>

      <button onClick={save} disabled={saving}
        className="lj-btn-primary flex items-center gap-2 w-full justify-center">
        {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save size={16} />}
        {saving ? "Saving…" : "Save Changes"}
      </button>

      <button onClick={logout} disabled={loggingOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
        style={{ borderColor: "rgba(255,61,90,0.3)" }}>
        {loggingOut ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" /> : <LogOut size={16} />}
        Sign Out
      </button>
    </div>
  );
}
