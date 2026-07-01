import { createAdminClient } from "@/lib/supabase/admin";

export class PaymentVerifier {
  // Looking up a deposit by its payment_reference happens from the
  // Fapshi webhook and the post-redirect /complete callback - neither
  // has the depositor's browser session/cookies, so the regular
  // anon-key client has no auth.uid() and RLS ("users can view own
  // deposits") blocks the read entirely. This is inherently a trusted
  // server-to-server lookup, so it uses the service-role client.
  static async depositExists(reference: string) {
    const supabase = createAdminClient();

    const { data } = await supabase
      .from("deposits")
      .select("*")
      .eq("payment_reference", reference)
      .maybeSingle();

    return data;
  }
}
