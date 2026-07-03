import { NextResponse } from "next/server";

import { validateWebhook } from "@/lib/fapshi/webhook-validator";
import { getFapshiPaymentStatus, getFapshiPayoutStatus } from "@/lib/fapshi/fapshi-client";
import { PaymentProcessor } from "@/lib/payments/payment-processor";
import { WithdrawalSettlementService } from "@/lib/withdrawals/withdrawal-settlement";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const providedSecret = new URL(request.url).searchParams.get("secret");

    if (!validateWebhook(payload, providedSecret)) {
      return NextResponse.json(
        { success: false, message: "Invalid webhook" },
        { status: 400 },
      );
    }

    // Never trust payload.status directly - Fapshi webhooks aren't
    // signed, so anyone who finds this URL could POST a fake
    // "SUCCESSFUL" body. Re-check the real status directly with
    // Fapshi using our own API credentials before crediting anything.
    // A payout's transId only exists on the payout service, so it
    // has to be re-verified with payout credentials, not collection
    // credentials - payload.transType (untrusted, but only used here
    // to pick which credential set to query with, not to decide
    // success/failure) tells us which one to use.
    const isPayout = payload.transType === "Payout";
    const verified = isPayout
      ? await getFapshiPayoutStatus(payload.transId)
      : await getFapshiPaymentStatus(payload.transId);

    if (isPayout) {
      // externalId is set to the withdrawal id when we call /payout
      // (see app/api/withdrawals/create/route.ts). The synchronous
      // /payout response never carries a final status - this webhook
      // delivery is what actually confirms the payout, so this is
      // the only place a withdrawal moves out of 'processing'.
      const withdrawalId = verified.externalId ?? payload.externalId;
      if (withdrawalId) {
        if (verified.status === "SUCCESSFUL") {
          await WithdrawalSettlementService.markCompleted(
            withdrawalId,
            verified.financialTransId ?? verified.transId,
          );
        } else if (verified.status === "FAILED" || verified.status === "EXPIRED") {
          await WithdrawalSettlementService.markFailed(
            withdrawalId,
            `Fapshi payout ${verified.status.toLowerCase()}`,
          );
        }
        // PENDING/CREATED: still in flight, nothing to do yet -
        // another webhook delivery will follow once it resolves.
      }
    } else if (verified.status === "SUCCESSFUL") {
      const reference = verified.externalId ?? payload.externalId;
      if (reference) {
        await PaymentProcessor.completeDeposit(reference, verified.amount);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fapshi webhook processing failed", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
