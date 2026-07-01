"use client";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function MarkAllRead({ userId }: { userId: string }) {
  const router = useRouter();
  async function mark() {
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    router.refresh();
  }
  return (
    <button onClick={mark} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--lj-muted)] hover:text-white hover:bg-white/5 transition-colors">
      <CheckCheck size={14}/> Mark all read
    </button>
  );
}
