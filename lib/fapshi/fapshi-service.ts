import { DepositService } from "@/lib/deposits/deposit-service";
import { initiateFapshiPayment } from "./fapshi-client";

export class FapshiService {
  static async createPaymentLink(userId: string, amount: number, phone: string) {
    const deposit = await DepositService.createDeposit(userId, amount, phone);

    const payment = await initiateFapshiPayment({
      amount,
      userId,
      externalId: deposit.payment_reference,
      message: "Lucky Jambo Wallet Deposit",
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/wallet/deposit?ref=${deposit.payment_reference}`,
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
