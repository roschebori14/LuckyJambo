"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react";
import { getRememberedEmail, setRememberedEmail } from "@/lib/cookies/preferences";
import { openCookieSettings } from "@/lib/cookies/cookie-consent";
import { useCookieConsent } from "@/lib/cookies/use-cookie-consent";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { functionalAllowed, hydrated } = useCookieConsent();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Prefill from a previously-remembered email once we've read cookies client-side.
  useEffect(() => {
    const remembered = getRememberedEmail();
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setRememberedEmail(email, rememberMe);
    // Only follow same-origin, in-app paths - never an absolute/external
    // URL a query param could otherwise smuggle in.
    const redirect = searchParams.get("redirect");
    const destination = redirect && redirect.startsWith("/") && !redirect.startsWith("//")
      ? redirect
      : "/dashboard";
    router.push(destination);
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
          onChange={e => setEmail(e.target.value)} className="lj-input !pl-11" />
      </div>

      <div className="relative">
        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)]" />
        <input type="password" placeholder="Password" required value={password}
          onChange={e => setPassword(e.target.value)} className="lj-input !pl-11" />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-[var(--lj-muted)]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--lj-border)] accent-[var(--lj-blue)]"
          />
          Remember my email
        </label>
        <Link href="/forgot-password" className="text-xs text-[var(--lj-blue-2)] hover:text-[var(--lj-cyan)]">
          Forgot password?
        </Link>
      </div>
      {rememberMe && hydrated && !functionalAllowed && (
        <p className="-mt-2 text-xs text-[var(--lj-muted)]">
          Enable functional cookies in{" "}
          <button type="button" onClick={openCookieSettings} className="text-[var(--lj-blue-2)] hover:underline">
            Cookie settings
          </button>{" "}
          to keep this remembered next time.
        </p>
      )}

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
