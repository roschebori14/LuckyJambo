import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DepositService } from "@/lib/deposits/deposit-service";
import { depositSchema } from "@/lib/deposits/deposit-validator";
import { initiatePay } from "@/lib/fapshi/fapshi-client";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = depositSchema.parse(body);

    // 1. Create the pending deposit row first (gives us a reference
    //    to pass to Fapshi as externalId for reconciliation).
    let deposit;
    try {
      deposit = await DepositService.createDeposit(user.id, validated.amount);
    } catch (dbError) {
      // Supabase/Postgrest errors don't reliably pass `instanceof Error`
      // in every runtime, which was swallowing real failures (e.g. a
      // missing column from an unapplied migration, or an RLS denial)
      // behind a useless generic message. Surface the real thing.
      console.error("Deposit insert failed:", dbError);
      const msg =
        (dbError as { message?: string })?.message ??
        "Could not create deposit record. Check that all migrations are applied.";
      return NextResponse.json({ success: false, message: msg }, { status: 400 });
    }

    // 2. Ask Fapshi for a hosted payment link.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    let payment;
    try {
      payment = await initiatePay({
        amount: validated.amount,
        email: user.email,
        redirectUrl: `${appUrl}/wallet/deposit?status=returned`,
        userId: user.id,
        externalId: deposit.payment_reference,
        message: "Lucky Jambo Wallet Deposit",
      });
    } catch (fapshiError) {
      console.error("Fapshi initiate-pay failed:", fapshiError);
      // The deposit row already exists as 'pending' — mark it failed
      // rather than leaving an orphaned pending row with no payment link.
      await DepositService.markStatus(deposit.payment_reference, "failed");
      const msg =
        (fapshiError as { message?: string })?.message ??
        "Could not reach the payment provider. Please try again.";
      return NextResponse.json({ success: false, message: msg }, { status: 502 });
    }

    // Store Fapshi's transId against the deposit row for the webhook
    // to use when it confirms status with us later.
    try {
      const admin = (await import("@/lib/supabase/admin")).createAdminClient();
      await admin.from("deposits")
        .update({ provider_transaction_id: payment.transId, payment_url: payment.link })
        .eq("id", deposit.id);
    } catch (updateError) {
      // Non-fatal: the payment link already exists and works even if
      // this bookkeeping update fails. Log it, don't block the user.
      console.error("Failed to store Fapshi transId on deposit row:", updateError);
    }

    return NextResponse.json({ success: true, deposit, paymentLink: payment.link, transId: payment.transId });
  } catch (error) {
    console.error("Deposit creation route error:", error);
    const message = (error as { message?: string })?.message ?? "Failed to create deposit";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
