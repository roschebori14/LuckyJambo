"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await supabase.auth.resetPasswordForEmail(email);
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm text-[var(--lj-muted)]">
        If an account exists for <span className="text-white">{email}</span>, a reset link is on its way.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        placeholder="Email address"
        required
        className="lj-input"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button type="submit" className="lj-btn-primary w-full">
        Reset Password
      </button>
    </form>
  );
}
