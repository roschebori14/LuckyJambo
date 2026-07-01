import { createAdminClient } from "@/lib/supabase/admin";

export class DuplicateChecker {
  // Same reasoning as PaymentVerifier: called from webhook/complete
  // callbacks with no user session, so this needs the service-role
  // client to actually see the row under RLS.
  static async alreadyCompleted(reference: string) {
    const supabase = createAdminClient();

    const { data } = await supabase
      .from("deposits")
      .select("status")
      .eq("payment_reference", reference)
      .maybeSingle();

    return data?.status === "completed";
  }
}
