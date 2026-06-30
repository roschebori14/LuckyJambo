"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="relative">
        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)]" />
        <input type="email" placeholder="Email address" required value={email}
          onChange={e => setEmail(e.target.value)} className="lj-input pl-10" />
      </div>

      <div className="relative">
        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)]" />
        <input type="password" placeholder="Password" required value={password}
          onChange={e => setPassword(e.target.value)} className="lj-input pl-10" />
      </div>

      <div className="text-right">
        <Link href="/forgot-password" className="text-xs text-[var(--lj-blue-2)] hover:text-[var(--lj-cyan)]">
          Forgot password?
        </Link>
      </div>

      <button type="submit" disabled={loading} className="lj-btn-primary flex w-full items-center justify-center gap-2">
        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <LogIn size={16} />}
        {loading ? "Signing in…" : "Sign In"}
      </button>

      <p className="text-center text-sm text-[var(--lj-muted)]">
        No account?{" "}
        <Link href="/register" className="font-semibold text-[var(--lj-blue-2)] hover:text-[var(--lj-cyan)]">
          Create one free
        </Link>
      </p>
    </form>
  );
}
