import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getFapshiPaymentStatus } from "@/lib/fapshi/fapshi-client";
import { PaymentProcessor } from "@/lib/payments/payment-processor";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Used by the deposit UI to poll for payment completion after the
 * user is sent to the Fapshi hosted payment page. Takes the Fapshi
 * transId returned at initiate time, checks the real status directly
 * with Fapshi, and - if paid - credits the wallet the same way the
 * webhook does (safe to call from both; PaymentProcessor.completeDeposit
 * is idempotent, so a race between the webhook and this polling call
 * just results in the second one seeing "already processed").
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const transId = typeof body.transId === "string" ? body.transId : null;

    if (!transId) {
      return NextResponse.json({ success: false, message: "transId is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: deposit } = await admin
      .from("deposits")
      .select("*")
      .eq("provider_transaction_id", transId)
      .maybeSingle();

    // Only let a user verify/complete their own deposit.
    if (!deposit || deposit.user_id !== user.id) {
      return NextResponse.json({ success: false, message: "Deposit not found" }, { status: 404 });
    }

    const verified = await getFapshiPaymentStatus(transId);

    if (verified.status === "SUCCESSFUL") {
      await PaymentProcessor.completeDeposit(deposit.payment_reference, verified.amount);
    }

    return NextResponse.json({
      success: true,
      status: verified.status,
      amount: verified.amount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
