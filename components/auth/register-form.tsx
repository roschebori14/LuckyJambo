"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { User, Mail, Lock, UserPlus, AlertCircle, CheckCircle } from "lucide-react";

export default function RegisterForm() {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (username.length < 3) { setError("Username must be at least 3 characters"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError("Username: letters, numbers, underscores only"); return; }

    setLoading(true);

    // AI content check - catches impersonation/profanity beyond what
    // the regex above can detect. Fails open (allows signup) if the
    // moderation call itself errors, so an AI outage never blocks signups.
    try {
      const modRes = await fetch("/api/ai/moderate-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const mod = await modRes.json();
      if (mod.allowed === false) {
        setError(mod.reason || "This username isn't allowed. Please choose another.");
        setLoading(false);
        return;
      }
    } catch { /* fail open - proceed with signup */ }

    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username } },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  }

  if (done) return (
    <div className="space-y-4 text-center">
      <CheckCircle size={48} className="mx-auto text-[var(--lj-success)]" />
      <h3 className="text-lg font-bold text-white">Check your email</h3>
      <p className="text-sm text-[var(--lj-muted)]">
        We sent a confirmation link to <strong className="text-white">{email}</strong>.
        Click it to activate your account, then sign in.
      </p>
      <button onClick={() => router.push("/login")} className="lj-btn-primary w-full">
        Go to Login
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="relative">
        <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)]" />
        <input type="text" placeholder="Username (e.g. kwame_striker)" required value={username}
          onChange={e => setUsername(e.target.value)} className="lj-input !pl-11" />
      </div>
      <div className="relative">
        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)]" />
        <input type="email" placeholder="Email address" required value={email}
          onChange={e => setEmail(e.target.value)} className="lj-input !pl-11" />
      </div>
      <div className="relative">
        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)]" />
        <input type="password" placeholder="Password (min 8 chars)" required value={password}
          onChange={e => setPassword(e.target.value)} className="lj-input !pl-11" />
      </div>
      <div className="relative">
        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)]" />
        <input type="password" placeholder="Confirm password" required value={confirm}
          onChange={e => setConfirm(e.target.value)} className="lj-input !pl-11" />
      </div>

      <button type="submit" disabled={loading} className="lj-btn-primary flex w-full items-center justify-center gap-2">
        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <UserPlus size={16} />}
        {loading ? "Creating account…" : "Create Account"}
      </button>

      <p className="text-center text-sm text-[var(--lj-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--lj-blue-2)] hover:text-[var(--lj-cyan)]">Sign in</Link>
      </p>
    </form>
  );
}
