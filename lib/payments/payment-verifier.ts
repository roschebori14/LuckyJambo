import { createClient } from "@/lib/supabase/server";

export class PaymentVerifier {
  static async depositExists(reference: string) {
    const supabase = await createClient();

    const { data } = await supabase
      .from("deposits")
      .select("*")
      .eq("payment_reference", reference)
      .single();

    return data;
  }
}
