import { createAdminClient } from "@/lib/supabase/admin";

// Uses the service-role client deliberately: this is consulted from
// the Fapshi webhook handler, which has no authenticated user session
// (Fapshi's server calls us directly, not a logged-in browser).
export class PaymentVerifier {
  static async depositExists(reference: string) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("deposits")
      .select("*")
      .eq("payment_reference", reference)
      .single();
    return data;
  }
}
