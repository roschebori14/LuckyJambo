import { NextResponse } from "next/server";

import { getFapshiPaymentStatus } from "@/lib/fapshi/fapshi-client";
import { PaymentProcessor } from "@/lib/payments/payment-processor";

/**
 * Completion callback for flows that redirect back with Fapshi's
 * transId (e.g. a client-side "I've paid" confirmation after the
 * hosted payment page redirects home). This used to trust the caller's
 * own externalId + amount with no verification at all, which meant
 * anyone could POST an arbitrary deposit reference + amount here and
 * have it instantly credited. It now always re-checks the real status
 * with Fapshi before crediting anything.
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const transId = typeof payload.transId === "string" ? payload.transId : null;

    if (!transId) {
      return NextResponse.json(
        { success: false, message: "transId is required" },
        { status: 400 },
      );
    }

    const verified = await getFapshiPaymentStatus(transId);

    if (verified.status !== "SUCCESSFUL") {
      return NextResponse.json({ success: true, status: verified.status });
    }

    const reference = verified.externalId;
    if (!reference) {
      return NextResponse.json(
        { success: false, message: "Payment has no externalId to reconcile" },
        { status: 400 },
      );
    }

    const result = await PaymentProcessor.completeDeposit(reference, verified.amount);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Payment completion failed",
      },
      {
        status: 500,
      },
    );
  }
}
