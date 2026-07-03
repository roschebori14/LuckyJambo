import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { WithdrawalService } from "@/lib/withdrawals/withdrawal-service";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const withdrawals = await WithdrawalService.getWithdrawals(user.id);

    return NextResponse.json({
      success: true,
      withdrawals,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to load withdrawals",
      },
      {
        status: 500,
      },
    );
  }
}
