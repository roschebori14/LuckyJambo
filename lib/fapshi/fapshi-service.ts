import { DepositService } from "@/lib/deposits/deposit-service";
import { initiateFapshiPayment } from "./fapshi-client";

export class FapshiService {
  static async createPaymentLink(
    userId: string,
    amount: number,
    phone: string,
    originFallback?: string,
  ) {
    const deposit = await DepositService.createDeposit(userId, amount, phone);

    // Prefer the explicit canonical domain if it's configured; fall back
    // to the origin the request actually came in on so this never
    // degrades into a relative URL (which Fapshi can't redirect to).
    const base = process.env.NEXT_PUBLIC_APP_URL || originFallback || "";

    const payment = await initiateFapshiPayment({
      amount,
      userId,
      externalId: deposit.payment_reference,
      message: "Lucky Jambo Wallet Deposit",
      redirectUrl: `${base}/wallet/deposit?ref=${deposit.payment_reference}`,
    });

    // Persist Fapshi's transId + hosted payment link on the deposit
    // row so later verification (polling, redirect callback, webhook)
    // can look this deposit up by provider_transaction_id.
    const updated = await DepositService.attachProviderDetails(
      deposit.id,
      payment.transId,
      payment.link,
    );

    return {
      deposit: updated,
      paymentLink: payment.link,
      transId: payment.transId,
    };
  }
}
