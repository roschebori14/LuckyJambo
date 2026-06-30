import { createClient } from "@/lib/supabase/server";

export async function createAuditLog(
  adminId: string,
  action: string,
  targetId?: string,
) {
  const supabase = await createClient();

  return supabase.from("admin_logs").insert({
    admin_id: adminId,
    action,
    target_id: targetId,
  });
}
