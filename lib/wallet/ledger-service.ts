import { createClient } from "@/lib/supabase/server";
import type { CreateLedgerEntry, LedgerEntry } from "@/types/ledger";

export class LedgerService {
  /**
   * Writes a ledger row directly. This does NOT update wallets.balance -
   * it only records history. For anything that should also move money,
   * use WalletService.applyTransaction() instead, which updates the
   * balance and writes the ledger row atomically in one DB transaction.
   */
  static async createEntry(entry: CreateLedgerEntry): Promise<LedgerEntry> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("wallet_ledger")
      .insert({
        wallet_id: entry.wallet_id,
        user_id: entry.user_id,
        type: entry.type,
        amount: entry.amount,
        balance_before: entry.balance_before,
        balance_after: entry.balance_after,
        reference: entry.reference ?? null,
        description: entry.description ?? null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  static async getHistory(userId: string, limit = 50): Promise<LedgerEntry[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("wallet_ledger")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data ?? [];
  }
}
