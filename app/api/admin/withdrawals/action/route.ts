import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPayout } from "@/lib/fapshi/fapshi-client";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ success: false }, { status: 403 });

    const { withdrawal_id, action } = await request.json();
    if (!withdrawal_id || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: withdrawal } = await admin
      .from("withdrawals")
      .select("*, profiles(username)")
      .eq("id", withdrawal_id)
      .single();

    if (!withdrawal) return NextResponse.json({ success: false, message: "Withdrawal not found" }, { status: 404 });
    if (withdrawal.status !== "pending") {
      return NextResponse.json({ success: false, message: "Withdrawal already processed" }, { status: 400 });
    }

    if (action === "reject") {
      const { error: refundErr } = await admin.rpc("apply_wallet_transaction", {
        p_user_id: withdrawal.user_id, p_type: "refund", p_amount: withdrawal.amount,
        p_reference: withdrawal_id, p_description: "Withdrawal rejected by admin",
      });
      if (refundErr) throw refundErr;

      await admin.from("withdrawals").update({ status: "rejected", processed_at: new Date().toISOString() }).eq("id", withdrawal_id);

      await admin.rpc("notify_user", {
        p_user_id: withdrawal.user_id, p_title: "Withdrawal rejected",
        p_message: `Your withdrawal of ${withdrawal.amount.toLocaleString()} XAF was rejected and the funds returned to your wallet.`,
      });

      return NextResponse.json({ success: true });
    }

    // Approve: actually call Fapshi's payout API now, rather than just
    // flipping a status flag (the original implementation marked
    // withdrawals "completed" without ever sending money - fixed here).
    const medium = withdrawal.provider === "mtn" ? "mobile money" : "orange money";

    let payoutTransId: string;
    try {
      const payout = await sendPayout({
        amount: withdrawal.amount,
        phone: withdrawal.account_number,
        medium,
        name: (withdrawal.profiles as { username: string } | null)?.username,
        userId: withdrawal.user_id,
        externalId: withdrawal.transaction_reference,
        message: "Lucky Jambo withdrawal (admin approved)",
      });
      payoutTransId = payout.transId;
    } catch (payoutError) {
      return NextResponse.json({
        success: false,
        message: `Fapshi payout failed: ${(payoutError as Error).message}. Funds remain locked - try again or reject to refund the user.`,
      }, { status: 502 });
    }

    const { error: lossErr } = await admin.rpc("apply_wallet_transaction", {
      p_user_id: withdrawal.user_id, p_type: "match_loss", p_amount: withdrawal.amount,
      p_reference: withdrawal_id, p_description: "Withdrawal approved and paid out",
    });
    if (lossErr) throw lossErr;

    await admin.from("withdrawals").update({
      status: "completed",
      financial_trans_id: payoutTransId,
      processed_at: new Date().toISOString(),
    }).eq("id", withdrawal_id);

    await admin.rpc("notify_user", {
      p_user_id: withdrawal.user_id, p_title: "Withdrawal sent",
      p_message: `${withdrawal.amount.toLocaleString()} XAF was sent to your ${withdrawal.provider.toUpperCase()} number.`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
