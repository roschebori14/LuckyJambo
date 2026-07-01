import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WithdrawalService } from "@/lib/withdrawals/withdrawal-service";
import { withdrawalSchema } from "@/lib/withdrawals/withdrawal-validator";
import { initiateFapshiPayout } from "@/lib/fapshi/fapshi-client";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const body = await request.json();
    const validated = withdrawalSchema.parse(body);

    // 1. Request withdrawal to lock funds and create database row (initially 'pending')
    const withdrawal = await WithdrawalService.requestWithdrawal(
      validated.amount,
      validated.account_number,
      validated.provider,
    );

    // 2. Call Fapshi Payout API
    const medium = validated.provider === "mtn" ? "mobile money" : "orange money";
    try {
      const payoutResult = await initiateFapshiPayout({
        amount: validated.amount,
        phone: validated.account_number,
        medium,
        userId: user.id,
        externalId: withdrawal.id,
        message: "Lucky Jambo Automatic Wallet Withdrawal",
      });

      // 3. Payout succeeded: consume locked balance and mark withdrawal as completed
      const admin = createAdminClient();
      
      const { error: lossErr } = await admin.rpc("apply_wallet_transaction", {
        p_user_id: user.id,
        p_type: "match_loss", // consumes locked balance
        p_amount: validated.amount,
        p_reference: withdrawal.id,
        p_description: `Automatic withdrawal paid via Fapshi (Trans ID: ${payoutResult.transId})`,
      });
      if (lossErr) throw lossErr;

      await admin.from("withdrawals").update({
        status: "completed",
        transaction_reference: payoutResult.transId
      }).eq("id", withdrawal.id);

      return NextResponse.json({ success: true, withdrawal: { ...withdrawal, status: "completed" } });
    } catch (payoutErr) {
      // 4. Payout failed: release locked balance back to available and mark withdrawal as failed
      const admin = createAdminClient();
      
      await admin.rpc("apply_wallet_transaction", {
        p_user_id: user.id,
        p_type: "refund", // releases locked balance back to available
        p_amount: validated.amount,
        p_reference: withdrawal.id,
        p_description: `Automatic withdrawal failed: ${(payoutErr as Error).message}`,
      });

      await admin.from("withdrawals").update({
        status: "failed"
      }).eq("id", withdrawal.id);

      throw payoutErr;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create withdrawal";
    return NextResponse.json(
      { success: false, message },
      { status: 400 },
    );
  }
}

