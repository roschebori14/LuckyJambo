import { NextResponse } from "next/server";

import { DepositService } from "@/lib/deposits/deposit-service";
import { depositSchema } from "@/lib/deposits/deposit-validator";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validated = depositSchema.parse(body);

    const deposit = await DepositService.createDeposit(
      "temporary-user-id",
      validated.amount,
    );

    return NextResponse.json({
      success: true,
      deposit,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create deposit",
      },
      {
        status: 400,
      },
    );
  }
}
