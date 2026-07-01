import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDepositReference } from "./deposit-utils";

export class DepositService {
  static async createDeposit(userId: string, amount: number, phone: string) {
    const supabase = await createClient();
    const reference = generateDepositReference();

    const { data, error } = await supabase
      .from("deposits")
      .insert({
        user_id: userId,
        amount,
        phone,
        status: "pending",
        payment_reference: reference,
        provider: "fapshi",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async attachProviderDetails(
    depositId: string,
    providerTransactionId: string,
    paymentUrl: string,
  ) {
    // Regular users only have an INSERT policy on deposits, not
    // UPDATE - this follow-up write (recording Fapshi's transId once
    // we have it) needs the service-role client.
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("deposits")
      .update({
        provider_transaction_id: providerTransactionId,
        payment_url: paymentUrl,
      })
      .eq("id", depositId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getDeposits(userId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("deposits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  static async getHistory(userId: string, limit = 20) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("deposits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }
}
