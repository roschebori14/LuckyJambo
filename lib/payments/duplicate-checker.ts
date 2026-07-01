import { createAdminClient } from "@/lib/supabase/admin";

export class DuplicateChecker {
  static async alreadyCompleted(reference: string) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("deposits")
      .select("status")
      .eq("payment_reference", reference)
      .single();
    return data?.status === "completed";
  }
}
