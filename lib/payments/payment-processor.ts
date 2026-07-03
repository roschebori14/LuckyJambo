import { WalletService } from "@/lib/wallet/wallet-service";
import { PaymentVerifier } from "./payment-verifier";
import { DuplicateChecker } from "./duplicate-checker";
import { createAdminClient } from "@/lib/supabase/admin";

export class PaymentProcessor {
  static async completeDeposit(reference: string, amount: number) {
    const deposit = await PaymentVerifier.depositExists(reference);
    if (!deposit) throw new Error("Deposit not found");

    const alreadyCompleted = await DuplicateChecker.alreadyCompleted(reference);
    if (alreadyCompleted) return { success: true, message: "Already processed" };

    if (deposit.status === "failed" || deposit.status === "cancelled") {
      throw new Error(`Deposit ${reference} was already marked ${deposit.status}`);
    }

    // Credit the amount Fapshi actually confirmed, not whatever the
    // caller passed in - keeps a forged/garbled amount param from
    // crediting more than the user actually paid.
    const creditAmount = amount > 0 ? amount : deposit.amount;

    // apply_wallet_transaction atomically: credits wallet + writes ledger row.
    // Runs via the service-role client inside WalletService (see
    // migration 012 - this RPC is no longer callable by anon/authenticated).
    try {
      await WalletService.applyTransaction({
        userId: deposit.user_id,
        type: "deposit",
        amount: creditAmount,
        reference,
        description: "Fapshi deposit confirmed",
      });
    } catch (error) {
      // Every caller of completeDeposit (webhook, poll, redirect
      // callback, reconciler) catches this and turns it into a quiet
      // 400/500 response - which is correct for the HTTP layer, but
      // without a log line here a stuck-pending deposit is invisible
      // until a user complains. This is the one place all of those
      // paths funnel through, so it's the one place that needs to
      // shout.
      console.error(
        `completeDeposit failed for ${reference} (user ${deposit.user_id}, amount ${creditAmount}):`,
        error,
      );
      throw error;
    }

    const supabase = createAdminClient();
    await supabase
      .from("deposits")
      .update({ status: "completed" })
      .eq("id", deposit.id);

    return { success: true };
  }
}
