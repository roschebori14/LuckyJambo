import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFapshiPaymentStatus } from "@/lib/fapshi/fapshi-client";
import { PaymentProcessor } from "@/lib/payments/payment-processor";

/**
 * Same idea as /api/fapshi/verify but keyed by our own deposit
 * reference (?ref=... on the Fapshi redirect URL) instead of Fapshi's
 * transId - convenient for the page the user lands back on after
 * paying, which only has the reference in its query string.
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
    const reference = typeof body.reference === "string" ? body.reference : null;

    if (!reference) {
      return NextResponse.json({ success: false, message: "reference is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: deposit } = await admin
      .from("deposits")
      .select("*")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (!deposit || deposit.user_id !== user.id) {
      return NextResponse.json({ success: false, message: "Deposit not found" }, { status: 404 });
    }

    if (deposit.status === "completed") {
      return NextResponse.json({ success: true, status: "SUCCESSFUL", amount: deposit.amount });
    }

    if (!deposit.provider_transaction_id) {
      return NextResponse.json({ success: true, status: "PENDING", amount: deposit.amount });
    }

    const verified = await getFapshiPaymentStatus(deposit.provider_transaction_id);

    if (verified.status === "SUCCESSFUL") {
      await PaymentProcessor.completeDeposit(reference, verified.amount);
    }

    return NextResponse.json({ success: true, status: verified.status, amount: verified.amount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
