import { ReactNode } from "react";
import Navbar from "@/components/layout/navbar";
import Sidebar from "@/components/layout/sidebar";
import SupportChatWidget from "@/components/ai/support-chat-widget";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { PresenceProvider } from "@/lib/presence/presence-context";
import { ToastProvider } from "@/components/ui/toast-provider";
import DmToastListener from "@/components/messages/dm-toast-listener";
import NotificationToastListener from "@/components/notifications/notification-toast-listener";
import { SoundProvider } from "@/lib/sound/sound-manager";
import ActiveMatchBanner from "@/components/matches/active-match-banner";

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
    <PresenceProvider userId={user?.id ?? ""}>
      <SoundProvider>
      <ToastProvider>
        {user && <DmToastListener userId={user.id} />}
        {user && <NotificationToastListener userId={user.id} />}
        <div className="min-h-screen" style={{ background: "var(--lj-navy)" }}>
          <Navbar />
          <div className="flex flex-col md:flex-row">
            <Sidebar isAdmin={isAdmin} />
            <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
              {user && <ActiveMatchBanner userId={user.id} />}
              {children}
            </main>
          </div>
          <SupportChatWidget />
        </div>
      </ToastProvider>
      </SoundProvider>
    </PresenceProvider>
  );
}
