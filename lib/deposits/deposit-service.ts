import { createClient } from "@/lib/supabase/server";
import { generateDepositReference } from "./deposit-utils";

export class DepositService {
  /**
   * Column names here match the LIVE deposits table (confirmed via
   * information_schema), which has drifted from what's in this repo's
   * migration files - it has both an older column generation
   * (fapshi_ref, external_id) and a newer one (provider_transaction_id,
   * payment_reference) that serve the same purposes. Since we can't
   * be sure which pair any existing DB functions/triggers key off,
   * this writes both pairs with the same values rather than guessing
   * which one is "real".
   *
   * amount is `bigint` on the live table (not numeric), so it must be
   * a whole number - fine for XAF, which has no subunit anyway.
   */
  static async createDeposit(userId: string, amount: number, phone: string) {
    const supabase = await createClient();
    const reference = generateDepositReference();
    const wholeAmount = Math.round(amount);

    const { data, error } = await supabase
      .from("deposits")
      .insert({
        user_id: userId,
        amount: wholeAmount,
        phone,
        status: "pending",
        provider: "fapshi",
        payment_reference: reference,
        external_id: reference,
      })
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

  static async markStatus(reference: string, status: "completed" | "failed" | "expired", providerTransactionId?: string) {
    const supabase = await createClient();
    const update: Record<string, unknown> = { status };
    if (providerTransactionId) {
      update.provider_transaction_id = providerTransactionId;
      update.fapshi_ref = providerTransactionId;
    }
    const { error } = await supabase.from("deposits").update(update).eq("payment_reference", reference);
    if (error) throw error;
  }
}
