import { createClient } from "@/lib/supabase/server";

export class WalletCreditor {
  static async creditWallet(userId: string, amount: number) {
    const supabase = await createClient();

    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const newBalance = wallet.available_balance + amount;

    await supabase
      .from("wallets")
      .update({
        available_balance: newBalance,
      })
      .eq("id", wallet.id);

    return newBalance;
  }
}
