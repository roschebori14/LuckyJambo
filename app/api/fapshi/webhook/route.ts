import { NextResponse } from "next/server";

import { validateWebhook } from "@/lib/fapshi/webhook-validator";
import { PaymentProcessor } from "@/lib/payments/payment-processor";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const valid = validateWebhook(payload);

    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid webhook",
        },
        {
          status: 400,
        },
      );
    }

    console.log("Fapshi webhook received", payload);

    if (payload.status === "SUCCESSFUL") {
      const reference = payload.externalId;
      const amount = Number(payload.amount);
      await PaymentProcessor.completeDeposit(reference, amount);
    }

    return NextResponse.json({
      success: true,
    });

  } catch {
    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      },
    );
  }
}
