import { WalletService } from "@/lib/wallet/wallet-service";
import { PaymentVerifier } from "./payment-verifier";
import { DuplicateChecker } from "./duplicate-checker";
import { createClient } from "@/lib/supabase/server";

export class PaymentProcessor {
  static async completeDeposit(reference: string, amount: number) {
    const deposit = await PaymentVerifier.depositExists(reference);
    if (!deposit) throw new Error("Deposit not found");

    const alreadyCompleted = await DuplicateChecker.alreadyCompleted(reference);
    if (alreadyCompleted) return { success: true, message: "Already processed" };

    // apply_wallet_transaction atomically: credits wallet + writes ledger row
    await WalletService.applyTransaction({
      userId: deposit.user_id,
      type: "deposit",
      amount,
      reference,
      description: "Fapshi deposit confirmed",
    });

    const supabase = await createClient();
    await supabase
      .from("deposits")
      .update({ status: "completed" })
      .eq("id", deposit.id);

    return { success: true };
  }
}
