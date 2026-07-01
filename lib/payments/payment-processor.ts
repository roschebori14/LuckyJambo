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

    // apply_wallet_transaction atomically: credits wallet + writes ledger row.
    // Runs as service_role (see WalletService.applyTransaction) since
    // this is invoked from the unauthenticated Fapshi webhook handler.
    await WalletService.applyTransaction({
      userId: deposit.user_id,
      type: "deposit",
      amount,
      reference,
      description: "Fapshi deposit confirmed",
    });

    const admin = createAdminClient();
    await admin
      .from("deposits")
      .update({ status: "completed" })
      .eq("id", deposit.id);

    await admin.rpc("notify_user", {
      p_user_id: deposit.user_id,
      p_title: "Deposit successful",
      p_message: `${amount.toLocaleString()} XAF has been added to your wallet.`,
    });

    return { success: true };
  }
}
