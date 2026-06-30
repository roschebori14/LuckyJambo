import { NextResponse } from "next/server";

import { FapshiService } from "@/lib/fapshi/fapshi-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const amount = Number(body.amount);

    const result = await FapshiService.createPaymentLink(
      "temporary-user-id",
      amount,
    );

    return NextResponse.json({
      success: true,
      paymentLink: result.paymentLink,
      transId: result.transId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Payment initiation failed",
      },
      {
        status: 400,
      },
    );
  }
}
