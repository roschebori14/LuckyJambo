import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WithdrawalService } from "@/lib/withdrawals/withdrawal-service";
import { withdrawalSchema } from "@/lib/withdrawals/withdrawal-validator";
import { sendPayout } from "@/lib/fapshi/fapshi-client";

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

    // request_withdrawal RPC: locks the funds atomically and creates
    // the withdrawal row. Identity comes from the server session via
    // auth.uid() inside the RPC, never from the request body.
    const withdrawal = await WithdrawalService.requestWithdrawal(
      validated.amount,
      validated.account_number,
      validated.provider,
    );

    // ── Automatic payout ─────────────────────────────────────────
    // Funds are already locked by the RPC above. If auto-payout is
    // enabled and the amount is at or below the configured threshold,
    // we immediately call Fapshi's payout API instead of waiting for
    // an admin to manually approve. Above the threshold, the request
    // stays `pending` for admin review (see /admin/withdrawals).
    const admin = createAdminClient();
    const { data: settingsRows } = await admin
      .from("settings")
      .select("key, value")
      .in("key", ["auto_withdrawal_enabled", "auto_withdrawal_max_amount"]);

    const settings = Object.fromEntries((settingsRows ?? []).map(r => [r.key, r.value]));
    const autoEnabled = settings.auto_withdrawal_enabled === "true";
    const autoMax = Number(settings.auto_withdrawal_max_amount ?? 0);

    if (autoEnabled && validated.amount <= autoMax) {
      try {
        const username = user.user_metadata?.username ?? "Player";
        const medium = validated.provider === "mtn" ? "mobile money" : "orange money";

        const payout = await sendPayout({
          amount: validated.amount,
          phone: validated.account_number,
          medium,
          name: username,
          userId: user.id,
          externalId: withdrawal.transaction_reference,
          message: "Lucky Jambo withdrawal",
        });

        // Consume the locked funds now that the payout call succeeded
        // (the funds left the platform). match_loss type releases a
        // lock without re-crediting available_balance - exactly what
        // a successful payout needs.
        await admin.rpc("apply_wallet_transaction", {
          p_user_id: user.id,
          p_type: "match_loss",
          p_amount: validated.amount,
          p_reference: withdrawal.id,
          p_description: "Withdrawal auto-paid via Fapshi",
        });

        await admin
          .from("withdrawals")
          .update({
            status: "completed",
            financial_trans_id: payout.transId,
            processed_at: new Date().toISOString(),
          })
          .eq("id", withdrawal.id);

        await admin.rpc("notify_user", {
          p_user_id: user.id,
          p_title: "Withdrawal sent",
          p_message: `${validated.amount.toLocaleString()} XAF was sent to your ${validated.provider.toUpperCase()} number.`,
        });

        return NextResponse.json({
          success: true,
          withdrawal: { ...withdrawal, status: "completed" },
          autoProcessed: true,
        });
      } catch (payoutError) {
        // Payout call failed (Fapshi error, network issue, etc).
        // Release the lock back to available balance and mark the
        // withdrawal failed rather than leaving it silently pending
        // and the user's money stuck in limbo.
        await admin.rpc("apply_wallet_transaction", {
          p_user_id: user.id,
          p_type: "refund",
          p_amount: validated.amount,
          p_reference: withdrawal.id,
          p_description: "Auto-payout failed - funds released",
        });

        await admin
          .from("withdrawals")
          .update({
            status: "failed",
            failure_reason: (payoutError as Error).message,
          })
          .eq("id", withdrawal.id);

        return NextResponse.json({
          success: false,
          message: "Automatic payout failed and your funds were released. Please try again or contact support.",
        }, { status: 502 });
      }
    }

    // Above the auto threshold (or auto-payout disabled) - stays
    // pending for manual admin review.
    return NextResponse.json({ success: true, withdrawal, autoProcessed: false });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create withdrawal";
    return NextResponse.json(
      { success: false, message },
      { status: 400 },
    );
  }
}
