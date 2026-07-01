import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Wallet, WalletTransactionType } from "@/types/wallet";
import type { LedgerEntry } from "@/types/ledger";

interface ApplyTransactionInput {
  userId: string;
  type: WalletTransactionType;
  amount: number;
  reference?: string;
  description?: string;
}

export class WalletService {
  static async getWallet(userId: string): Promise<Wallet> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  static async createWallet(userId: string): Promise<Wallet> {
    // Regular users have no INSERT policy on wallets (by design - the
    // 003_handle_new_user.sql trigger creates it on signup instead).
    // This is only a fallback for accounts predating that trigger, so
    // it needs the service-role client to actually succeed.
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("wallets")
      .insert({
        user_id: userId,
        available_balance: 0,
        locked_balance: 0,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Returns the user's wallet, creating one if it doesn't exist yet.
   * The 003_handle_new_user.sql trigger creates wallets for new signups
   * going forward, but this is a safety net for accounts created before
   * that migration ran, or for any other edge case.
   */
  static async getOrCreateWallet(userId: string): Promise<Wallet> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }

    return WalletService.createWallet(userId);
  }

  /**
   * The one safe way to move money. Calls the apply_wallet_transaction
   * Postgres function, which locks the wallet row, validates balance,
   * updates available/locked balance, and writes the matching ledger
   * row - all inside a single DB transaction so concurrent requests
   * can't race each other into an incorrect balance.
   *
   * apply_wallet_transaction takes an explicit p_user_id instead of
   * deriving identity from auth.uid(), so (per migration 012) it's
   * only executable by service_role - calling it with the anon-key,
   * cookie-scoped client would fail with "permission denied" now, and
   * would have been a privilege-escalation hole before that migration
   * (any authenticated user could've called it directly with someone
   * else's user id). Every caller here is trusted server-side code
   * (webhook handlers, payment completion, admin actions) that has
   * already done its own authorization check before calling this.
   */
  static async applyTransaction(
    input: ApplyTransactionInput,
  ): Promise<LedgerEntry> {
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("apply_wallet_transaction", {
      p_user_id: input.userId,
      p_type: input.type,
      p_amount: input.amount,
      p_reference: input.reference ?? null,
      p_description: input.description ?? null,
    });

    if (error) {
      throw error;
    }

    return data;
  }
}
