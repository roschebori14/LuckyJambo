import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WithdrawalService } from "@/lib/withdrawals/withdrawal-service";
import { withdrawalSchema } from "@/lib/withdrawals/withdrawal-validator";
import { initiateFapshiPayout } from "@/lib/fapshi/fapshi-client";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

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

      // 3. Fapshi accepted the request - this is NOT confirmation the
      // payout succeeded. The /payout response has no status field;
      // it only means the request was received. Funds stay locked
      // and the withdrawal stays out of a final state until the
      // Fapshi webhook confirms SUCCESSFUL/FAILED/EXPIRED (see
      // app/api/fapshi/webhook and WithdrawalSettlementService).
      const admin = createAdminClient();

      await admin.from("withdrawals").update({
        status: "processing",
        transaction_reference: payoutResult.transId,
        financial_trans_id: payoutResult.transId,
      }).eq("id", withdrawal.id);

      return NextResponse.json({
        success: true,
        withdrawal: { ...withdrawal, status: "processing" },
      });
    } catch (payoutErr) {
      // 4. Fapshi never accepted the request (network error, 4xx,
      // etc.) - this is the one case we know synchronously that
      // nothing is in flight, so it's safe to release the lock here
      // rather than waiting on a webhook that will never come.
      const admin = createAdminClient();
      const payoutErrMessage = getErrorMessage(payoutErr, "Fapshi payout request failed");

      await admin.rpc("apply_wallet_transaction", {
        p_user_id: user.id,
        p_type: "refund", // releases locked balance back to available
        p_amount: validated.amount,
        p_reference: withdrawal.id,
        p_description: `Automatic withdrawal failed: ${payoutErrMessage}`,
      });

      await admin.from("withdrawals").update({
        status: "failed",
        failure_reason: payoutErrMessage,
        processed_at: new Date().toISOString(),
      }).eq("id", withdrawal.id);

      throw payoutErr;
    }
  } catch (error) {
    const message = getErrorMessage(error, "Failed to create withdrawal");
    return NextResponse.json(
      { success: false, message },
      { status: 400 },
    );
  }
}

