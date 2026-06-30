import { NextResponse } from "next/server";

import { PaymentProcessor } from "@/lib/payments/payment-processor";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const reference = payload.externalId;

    const amount = Number(payload.amount);

    const result = await PaymentProcessor.completeDeposit(reference, amount);

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
