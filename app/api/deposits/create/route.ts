import { NextResponse } from "next/server";

import { DepositService } from "@/lib/deposits/deposit-service";
import { depositSchema } from "@/lib/deposits/deposit-validator";
import { createClient } from "@/lib/supabase/server";

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

    const validated = depositSchema.parse(body);

    const deposit = await DepositService.createDeposit(
      user.id,
      validated.amount,
    );


    return NextResponse.json({
      success: true,
      deposit,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create deposit",
      },
      {
        status: 400,
      },
    );
  }
}
