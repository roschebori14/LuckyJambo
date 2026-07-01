import { createClient } from "@/lib/supabase/server";
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
    const supabase = await createClient();

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
   * Not yet called from any route. Phase 3E / Phase 4 will call this
   * once a deposit is confirmed by Fapshi, or once a match settles.
   */
  static async applyTransaction(
    input: ApplyTransactionInput,
  ): Promise<LedgerEntry> {
    // Uses the service-role client deliberately. apply_wallet_transaction
    // is locked down (migration 017) so it can no longer be called
    // directly by a regular user session - only by service_role
    // (this method, used by the deposit webhook) or internally by the
    // other security-definer RPCs (create_match, settle_match, etc.)
    // which call it via `perform` rather than over PostgREST.
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("apply_wallet_transaction", {
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
