import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WithdrawalService } from "@/lib/withdrawals/withdrawal-service";
import { withdrawalSchema } from "@/lib/withdrawals/withdrawal-validator";

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

    // Identity comes from the server session, not the request body.
    // The request_withdrawal RPC uses auth.uid() directly so it cannot
    // act as another user regardless of what was sent.
    const withdrawal = await WithdrawalService.requestWithdrawal(
      validated.amount,
      validated.account_number,
      validated.provider,
    );

    return NextResponse.json({ success: true, withdrawal });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create withdrawal";
    return NextResponse.json(
      { success: false, message },
      { status: 400 },
    );
  }
}
