import { NextResponse } from "next/server";

import { WithdrawalService } from "@/lib/withdrawals/withdrawal-service";

export async function GET() {
  try {
    const withdrawals =
      await WithdrawalService.getWithdrawals("temporary-user-id");

    return NextResponse.json({
      success: true,
      withdrawals,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to load withdrawals",
      },
      {
        status: 500,
      },
    );
  }
}
