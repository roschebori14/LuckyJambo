import { ReactNode } from "react";
import Navbar from "@/components/layout/navbar";
import Sidebar from "@/components/layout/sidebar";
import SupportChatWidget from "@/components/ai/support-chat-widget";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await requireAuth();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    isAdmin = data?.role === "admin";
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--lj-navy)" }}>
      <Navbar />
      <div className="flex">
        <Sidebar isAdmin={isAdmin} />
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>
      <SupportChatWidget />
    </div>
  );
}
