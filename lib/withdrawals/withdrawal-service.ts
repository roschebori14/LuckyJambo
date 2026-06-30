import { createClient } from "@/lib/supabase/server";

export class WithdrawalService {
  static async requestWithdrawal(
    amount: number,
    accountNumber: string,
    provider: "mtn" | "orange",
  ) {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("request_withdrawal", {
      p_amount: amount,
      p_account_number: accountNumber,
      p_provider: provider,
    });

    if (error) throw error;
    return data;
  }

  static async getWithdrawals(userId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }
}
