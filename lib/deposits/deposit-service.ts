import { createClient } from "@/lib/supabase/server";
import { generateDepositReference } from "./deposit-utils";

export class DepositService {
  static async createDeposit(userId: string, amount: number) {
    const supabase = await createClient();
    const reference = generateDepositReference();

    const { data, error } = await supabase
      .from("deposits")
      .insert({
        user_id: userId,
        amount,
        status: "pending",
        payment_reference: reference,
        provider: "fapshi",
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
}
