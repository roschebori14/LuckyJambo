"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  User,
  Mail,
  Lock,
  UserPlus,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Circle,
} from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordChecks = [
    { label: "At least 8 characters", passed: password.length >= 8 },
    { label: "Contains a letter", passed: /[a-zA-Z]/.test(password) },
    { label: "Contains a number", passed: /[0-9]/.test(password) },
    {
      label: "Passwords match",
      passed: confirm.length > 0 && password === confirm,
    },
  ];
  const passwordValid = passwordChecks.every((c) => c.passed);

  function friendlyAuthError(message: string): string {
    const m = message.toLowerCase();
    if (
      m.includes("already registered") ||
      m.includes("already exists") ||
      m.includes("user already")
    ) {
      return "An account with this email already exists. Try signing in instead.";
    }
    if (m.includes("invalid") && m.includes("email")) {
      return "That email address doesn't look valid. Please check it and try again.";
    }
    if (m.includes("password")) {
      return "Your password doesn't meet the requirements. " + message;
    }
    if (m.includes("rate limit") || m.includes("too many")) {
      return "Too many attempts. Please wait a moment and try again.";
    }
    if (m.includes("network") || m.includes("fetch")) {
      return "Network error - please check your connection and try again.";
    }
    if (m.includes("database error saving new user")) {
      return "That username may already be taken. Please try a different username.";
    }
    return (
      message ||
      "Something went wrong while creating your account. Please try again."
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // The <input> below accepts spaces as typed (mobile keyboards/
    // autocomplete often add a stray leading/trailing space, and some
    // people try a "first last" style name) - but the regex below has
    // always rejected any username containing a space outright, which
    // is why users hit "Username: letters, numbers, underscores only"
    // for what looks like a perfectly normal name. Rather than reject
    // spaces, strip them before validating/saving so the character-set
    // check only ever sees what will actually be stored.
    const cleanUsername = username.replace(/\s+/g, "");

    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setError("Username: letters, numbers, underscores only");
      return;
    }
    if (!passwordValid) {
      setError("Please meet all password requirements below before continuing");
      return;
    }

    setLoading(true);

    // Username availability check - queries profiles directly so the user
    // gets an accurate "username taken" message before we ever call
    // signUp(). Without this, a collision surfaces later as a generic
    // "Database error saving new user" from the handle_new_user trigger.
    // Fails open (allows signup to proceed to the next check) if the RPC
    // itself errors, since the trigger now also handles collisions safely.
    try {
      const { data: available, error: checkErr } = await supabase.rpc(
        "is_username_available",
        { p_username: cleanUsername },
      );
      if (!checkErr && available === false) {
        setError("That username is taken. Please choose another.");
        setLoading(false);
        return;
      }
    } catch {
      /* fail open - proceed with signup */
    }

    // AI content check - catches impersonation/profanity beyond what
    // the regex above can detect. Fails open (allows signup) if the
    // moderation call itself errors, so an AI outage never blocks signups.
    try {
      const modRes = await fetch("/api/ai/moderate-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUsername }),
      });
      const mod = await modRes.json();
      if (mod.allowed === false) {
        setError(
          mod.reason || "This username isn't allowed. Please choose another.",
        );
        setLoading(false);
        return;
      }
    } catch {
      /* fail open - proceed with signup */
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: cleanUsername } },
      });
      if (error) {
        setError(friendlyAuthError(error.message));
        setLoading(false);
        return;
      }

      // Email confirmation is off, so signUp() returns an active session
      // right away - drop the user straight into the app instead of
      // making them wait on an email that will never need to arrive.
      if (data.session) {
        toast.success(`Welcome to Lucky Jambo, ${cleanUsername}!`, {
          description: "Your account is ready. Let's get you started.",
        });
        router.push("/dashboard");
        router.refresh();
        return;
      }

      // Fallback: if email confirmation ever gets re-enabled on the
      // Supabase project, there'll be no session yet - keep the old
      // "check your email" screen working for that case.
      toast.success("Account created!", {
        description: "Check your email to confirm and finish signing in.",
      });
      setDone(true);
    } catch {
      toast.error("Couldn't reach the server", {
        description: "Please check your connection and try again.",
      });
      setError(
        "Couldn't reach the server. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (done)
    return (
      <div className="space-y-4 text-center">
        <CheckCircle size={48} className="mx-auto text-[var(--lj-success)]" />
        <h3 className="text-lg font-bold text-white">Check your email</h3>
        <p className="text-sm text-[var(--lj-muted)]">
          We sent a confirmation link to{" "}
          <strong className="text-white">{email}</strong>. Click it to activate
          your account, then sign in.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="lj-btn-primary w-full"
        >
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
        <User
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)]"
        />
        <input
          type="text"
          placeholder="Username (e.g. kwame_striker)"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="lj-input !pl-11"
        />
      </div>
      <div className="relative">
        <Mail
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)]"
        />
        <input
          type="email"
          placeholder="Email address"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="lj-input !pl-11"
        />
      </div>
      <div className="relative">
        <Lock
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)]"
        />
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password (min 8 chars)"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="lj-input !pl-11 !pr-11"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)] hover:text-white"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <div className="relative">
        <Lock
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)]"
        />
        <input
          type={showConfirm ? "text" : "password"}
          placeholder="Confirm password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="lj-input !pl-11 !pr-11"
        />
        <button
          type="button"
          onClick={() => setShowConfirm((v) => !v)}
          aria-label={showConfirm ? "Hide password" : "Show password"}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)] hover:text-white"
        >
          {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {(password.length > 0 || confirm.length > 0) && (
        <ul className="space-y-1 rounded-xl border border-[var(--lj-border)] bg-white/5 px-4 py-3">
          {passwordChecks.map((check) => (
            <li
              key={check.label}
              className={`flex items-center gap-2 text-xs ${check.passed ? "text-[var(--lj-success)]" : "text-[var(--lj-muted)]"}`}
            >
              {check.passed ? <CheckCircle size={14} /> : <Circle size={14} />}
              {check.label}
            </li>
          ))}
        </ul>
      )}

      <button
        type="submit"
        disabled={loading || !passwordValid}
        className="lj-btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <UserPlus size={16} />
        )}
        {loading ? "Creating account…" : "Create Account"}
      </button>

      <p className="text-center text-sm text-[var(--lj-muted)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-[var(--lj-blue-2)] hover:text-[var(--lj-cyan)]"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
