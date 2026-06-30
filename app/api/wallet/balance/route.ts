import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { WalletService } from "@/lib/wallet/wallet-service";
import { BalanceEngine } from "@/lib/wallet/balance-engine";

export async function GET() {
  try {
    const user = await requireAuth();

    const wallet = await WalletService.getOrCreateWallet(user.id);

    const totalBalance = BalanceEngine.calculateTotalBalance(wallet);

    return NextResponse.json({
      success: true,
      wallet,
      totalBalance,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to load wallet balance",
      },
      {
        status: 500,
      },
    );
  }
}
