import { DepositService } from "@/lib/deposits/deposit-service";
import { initiateFapshiPayment } from "./fapshi-client";

export class FapshiService {
  static async createPaymentLink(userId: string, amount: number) {
    const deposit = await DepositService.createDeposit(userId, amount);

    const payment = await initiateFapshiPayment({
      amount,
      userId,
      externalId: deposit.payment_reference,
      message: "Lucky Jambo Wallet Deposit",
    });

    return {
      deposit,
      paymentLink: payment.link,
      transId: payment.transId,
    };
  }
}
