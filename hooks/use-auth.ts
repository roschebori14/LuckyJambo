"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthUser } from "@/types/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUser({
          id: user.id,
          email: user.email ?? "",
          username: user.user_metadata?.username ?? "",
          role: "user",
          is_verified: !!user.email_confirmed_at,
          created_at: user.created_at,
        });
      }

      setLoading(false);
    }

    getUser();
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
  };
}
