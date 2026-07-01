import { NextResponse } from "next/server";

import { validateWebhook } from "@/lib/fapshi/webhook-validator";
import { getFapshiPaymentStatus } from "@/lib/fapshi/fapshi-client";
import { PaymentProcessor } from "@/lib/payments/payment-processor";

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
    const verified = await getFapshiPaymentStatus(payload.transId);

    if (verified.status === "SUCCESSFUL") {
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
