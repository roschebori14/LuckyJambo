import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { Bell, CheckCheck } from "lucide-react";
import MarkAllRead from "./mark-all-read";

export default async function NotificationsPage() {
  const user = await requireAuth();
  const supabase = await createClient();
  const { data: notifs } = await supabase
    .from("notifications").select("*").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(50);

  const unread = (notifs ?? []).filter(n => !n.is_read).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <Bell size={24} style={{color:"var(--lj-cyan)"}}/> Notifications
          {unread > 0 && <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{background:"var(--lj-danger)"}}>{unread}</span>}
        </h1>
        {unread > 0 && <MarkAllRead userId={user.id} />}
      </div>

      <div className="lj-card overflow-hidden">
        {!notifs || notifs.length === 0
          ? <p className="py-10 text-center text-sm text-[var(--lj-muted)]">No notifications yet.</p>
          : <div className="divide-y" style={{borderColor:"var(--lj-border)"}}>
              {notifs.map(n => (
                <div key={n.id} className={`flex items-start gap-3 px-5 py-4 ${!n.is_read ? "bg-[rgba(26,86,255,0.05)]" : ""}`}>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{background:"var(--lj-cyan)"}}/>}
                  {n.is_read && <span className="mt-1.5 h-2 w-2 flex-shrink-0"/>}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{n.title}</p>
                    <p className="text-sm text-[var(--lj-muted)]">{n.message}</p>
                    <p className="mt-1 text-xs text-[var(--lj-muted)] opacity-60">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
