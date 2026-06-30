"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const supabase = createClient();

  const [email, setEmail] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    await supabase.auth.resetPasswordForEmail(email);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        placeholder="Email"
        className="w-full rounded border p-3"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button
        type="submit"
        className="w-full rounded bg-blue-600 p-3 text-white"
      >
        Reset Password
      </button>
    </form>
  );
}
