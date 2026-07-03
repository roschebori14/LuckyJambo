import { createAdminClient } from "@/lib/supabase/admin";
import { WalletService } from "@/lib/wallet/wallet-service";

const RESOLVED_STATUSES = new Set(["completed", "failed", "rejected"]);

export class WithdrawalSettlementService {
  // Called when Fapshi confirms a payout as SUCCESSFUL. Consumes the
  // locked balance that request_withdrawal reserved at request time.
  //
  // The status check below is a fast-path only, not the real
  // idempotency guard - two webhook deliveries for the same
  // transaction can race past it concurrently. The unique index on
  // wallet_ledger(reference) where type='match_loss' (migration 024)
  // is what actually prevents double-settlement: the second racing
  // call's apply_wallet_transaction insert violates that constraint
  // and rolls back.
  static async markCompleted(withdrawalId: string, financialTransId: string) {
    const admin = createAdminClient();

    const { data: withdrawal } = await admin
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawalId)
      .maybeSingle();

    if (!withdrawal) throw new Error(`Withdrawal ${withdrawalId} not found`);
    if (RESOLVED_STATUSES.has(withdrawal.status)) {
      return { success: true, message: "Already processed" };
    }

    await WalletService.applyTransaction({
      userId: withdrawal.user_id,
      type: "match_loss", // consumes locked balance
      amount: withdrawal.amount,
      reference: withdrawal.id,
      description: `Withdrawal paid via Fapshi (Trans ID: ${financialTransId})`,
    });

    await admin
      .from("withdrawals")
      .update({
        status: "completed",
        financial_trans_id: financialTransId,
        processed_at: new Date().toISOString(),
      })
      .eq("id", withdrawal.id);

    return { success: true };
  }

  // Called when Fapshi confirms a payout as FAILED or EXPIRED.
  // Releases the locked balance back to available. Same idempotency
  // reasoning as markCompleted, backed by the unique index on
  // wallet_ledger(reference) where type='refund'.
  static async markFailed(withdrawalId: string, reason: string) {
    const admin = createAdminClient();

    const { data: withdrawal } = await admin
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawalId)
      .maybeSingle();

    if (!withdrawal) throw new Error(`Withdrawal ${withdrawalId} not found`);
    if (RESOLVED_STATUSES.has(withdrawal.status)) {
      return { success: true, message: "Already processed" };
    }

    await WalletService.applyTransaction({
      userId: withdrawal.user_id,
      type: "refund", // releases locked balance back to available
      amount: withdrawal.amount,
      reference: withdrawal.id,
      description: `Automatic withdrawal failed: ${reason}`,
    });

    await admin
      .from("withdrawals")
      .update({
        status: "failed",
        failure_reason: reason,
        processed_at: new Date().toISOString(),
      })
      .eq("id", withdrawal.id);

    return { success: true };
  }
}
