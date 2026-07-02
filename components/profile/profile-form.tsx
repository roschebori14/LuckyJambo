"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, LogOut, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProfileService } from "@/lib/profile/profile-service";

interface Props {
  userId: string;
  initialUsername: string;
  initialFullName: string;
  initialBio: string;
  email: string;
}

export default function ProfileForm({
  userId,
  initialUsername,
  initialFullName,
  initialBio,
  email,
}: Props) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [fullName, setFullName] = useState(initialFullName);
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await ProfileService.update(userId, { username, full_name: fullName, bio });
      setStatus({ type: "success", message: "Profile updated!" });
      router.refresh();
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Could not save your changes",
      });
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {status && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
          style={{
            background: status.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(255,61,90,0.1)",
            color: status.type === "success" ? "var(--lj-success)" : "var(--lj-danger)",
          }}
        >
          {status.type === "success" ? (
            <CheckCircle2 size={14} className="shrink-0" />
          ) : (
            <AlertCircle size={14} className="shrink-0" />
          )}
          {status.message}
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">
          Username
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="lj-input"
          placeholder="your_username"
          maxLength={30}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">
          Full Name
        </label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="lj-input"
          placeholder="Your full name"
          maxLength={80}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="lj-input min-h-24 resize-none"
          placeholder="Tell other players a bit about yourself"
          maxLength={280}
        />
        <p className="mt-1 text-right text-xs text-[var(--lj-muted)]">{bio.length}/280</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">
          Email
        </label>
        <input value={email} disabled className="lj-input cursor-not-allowed opacity-50" />
        <p className="mt-1 text-xs text-[var(--lj-muted)]">Email cannot be changed here</p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="lj-btn-primary flex w-full items-center justify-center gap-2"
      >
        {saving ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <Save size={16} />
        )}
        {saving ? "Saving…" : "Save Changes"}
      </button>

      <button
        type="button"
        onClick={logout}
        disabled={loggingOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
        style={{ borderColor: "rgba(255,61,90,0.3)" }}
      >
        {loggingOut ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
        ) : (
          <LogOut size={16} />
        )}
        Sign Out
      </button>
    </form>
  );
}
