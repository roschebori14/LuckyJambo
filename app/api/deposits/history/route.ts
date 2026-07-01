import { NextResponse } from "next/server";

import { DepositService } from "@/lib/deposits/deposit-service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const deposits = await DepositService.getDeposits(user.id);

    return NextResponse.json({
      success: true,
      deposits,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch deposits",
      },
      {
        status: 500,
      }
    );
  }
}
