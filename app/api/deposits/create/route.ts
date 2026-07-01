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
    const deposit = await DepositService.createDeposit(user.id, validated.amount);

    // 2. Ask Fapshi for a hosted payment link.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const payment = await initiatePay({
      amount: validated.amount,
      email: user.email,
      redirectUrl: `${appUrl}/wallet/deposit?status=returned`,
      userId: user.id,
      externalId: deposit.payment_reference,
      message: "Lucky Jambo Wallet Deposit",
    });

    // Store Fapshi's transId against the deposit row for the webhook
    // to use when it confirms status with us later.
    const admin = (await import("@/lib/supabase/admin")).createAdminClient();
    await admin.from("deposits")
      .update({ provider_transaction_id: payment.transId, payment_url: payment.link })
      .eq("id", deposit.id);

    return NextResponse.json({ success: true, deposit, paymentLink: payment.link, transId: payment.transId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create deposit";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
