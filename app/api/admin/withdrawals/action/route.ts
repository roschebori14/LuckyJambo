import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ success: false }, { status: 403 });

    const { withdrawal_id, user_id, amount, action } = await request.json();
    if (!withdrawal_id || !user_id || !amount || !["approve","reject"].includes(action)) {
      return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 400 });
    }

    // Use service-role client so we can bypass RLS for admin mutations
    const admin = createAdminClient();

    if (action === "reject") {
      // Release the locked funds back to available. apply_wallet_transaction
      // takes an explicit target user id and is service_role-only (see
      // migration 012) - must go through the admin client, not the
      // caller's own cookie-scoped session.
      const { error: refundErr } = await admin.rpc("apply_wallet_transaction", {
        p_user_id: user_id, p_type: "refund", p_amount: amount,
        p_reference: withdrawal_id, p_description: "Withdrawal rejected by admin",
      });
      if (refundErr) throw refundErr;

      await admin.from("withdrawals").update({ status: "rejected" }).eq("id", withdrawal_id);
      return NextResponse.json({ success: true });
    }

    // Approve: mark completed (Fapshi payout happens here in Phase 4)
    // For now: funds stay locked (they left the platform on payout intent).
    // The locked balance drop happens when you actually call Fapshi payout API.
    // That is: deduct from locked when Fapshi confirms, not when admin approves.
    // For testability now, we finalize by consuming the locked balance.
    const { error: lossErr } = await admin.rpc("apply_wallet_transaction", {
      p_user_id: user_id, p_type: "match_loss", p_amount: amount,
      p_reference: withdrawal_id, p_description: "Withdrawal approved and paid out",
    });
    if (lossErr) throw lossErr;

    await admin.from("withdrawals").update({ status: "completed" }).eq("id", withdrawal_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
