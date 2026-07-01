import { NextResponse } from "next/server";
import { getPaymentStatus } from "@/lib/fapshi/fapshi-client";
import { PaymentVerifier } from "@/lib/payments/payment-verifier";
import { DuplicateChecker } from "@/lib/payments/duplicate-checker";
import { PaymentProcessor } from "@/lib/payments/payment-processor";
import { DepositService } from "@/lib/deposits/deposit-service";

/**
 * Fapshi webhook handler.
 *
 * IMPORTANT: Fapshi does not sign webhook payloads with an HMAC
 * secret (confirmed against their docs - the webhook body has no
 * signature field). That means we can NOT trust the incoming POST
 * body on its own; anyone who knows or guesses this URL could send a
 * fake "status": "SUCCESSFUL" payload and try to get a deposit
 * credited for free.
 *
 * Mitigation: we only ever use the webhook to learn *which* transId
 * to look up, then independently call Fapshi's own payment-status
 * endpoint, server-to-server, with our own API credentials, and trust
 * THAT response instead of the webhook body. An attacker can send us
 * any transId they want, but they can't make Fapshi's own status
 * endpoint lie about a transaction that didn't actually succeed.
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const transId = payload?.transId;

    if (!transId || typeof transId !== "string") {
      return NextResponse.json({ success: false, message: "Missing transId" }, { status: 400 });
    }

    // Authoritative check - never trust payload.status directly.
    const confirmed = await getPaymentStatus(transId);
    const reference = confirmed.externalId;

    if (!reference) {
      return NextResponse.json({ success: false, message: "No externalId on transaction" }, { status: 400 });
    }

    const deposit = await PaymentVerifier.depositExists(reference);
    if (!deposit) {
      return NextResponse.json({ success: false, message: "Deposit not found" }, { status: 404 });
    }

    // Idempotency: if we've already marked this completed, do nothing.
    // Fapshi may retry webhook delivery, and the unique index on
    // provider_transaction_id also backstops this at the DB level.
    const alreadyDone = await DuplicateChecker.alreadyCompleted(reference);
    if (alreadyDone) {
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    if (confirmed.status === "SUCCESSFUL") {
      await PaymentProcessor.completeDeposit(reference, confirmed.amount);
    } else if (confirmed.status === "FAILED") {
      await DepositService.markStatus(reference, "failed", transId);
    } else if (confirmed.status === "EXPIRED") {
      await DepositService.markStatus(reference, "expired", transId);
    }
    // CREATED / PENDING - nothing to do yet, wait for the next webhook.

    return NextResponse.json({ success: true });
  } catch (error) {
    // Returning 500 lets Fapshi retry delivery rather than silently
    // dropping a payment confirmation due to a transient error.
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
