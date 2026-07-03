import { WalletService } from "@/lib/wallet/wallet-service";
import { PaymentVerifier } from "./payment-verifier";
import { DuplicateChecker } from "./duplicate-checker";

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

    // complete_deposit atomically: credits wallet + writes ledger row +
    // marks the deposit 'completed', all inside one DB transaction (see
    // migration 025). Doing the credit and the status update as two
    // separate calls from here would let a crash/timeout between them
    // leave the user credited with the deposit stuck at 'pending'
    // forever - this way they can only ever commit or fail together.
    try {
      await WalletService.completeDeposit({
        depositId: deposit.id,
        userId: deposit.user_id,
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

    return { success: true };
  }
}
