import { NextResponse } from "next/server";

import { DepositService } from "@/lib/deposits/deposit-service";

export async function GET() {
  try {
    const deposits =
      await DepositService.getDeposits(
        "temporary-user-id"
      );

    return NextResponse.json({
      success: true,
      deposits,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to fetch deposits",
      },
      {
        status: 500,
      }
    );
  }
}