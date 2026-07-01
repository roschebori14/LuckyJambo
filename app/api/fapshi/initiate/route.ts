import { NextResponse } from "next/server";

import { FapshiService } from "@/lib/fapshi/fapshi-service";
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

    const result = await FapshiService.createPaymentLink(
      user.id,
      validated.amount,
      validated.phone,
    );

    return NextResponse.json({
      success: true,
      paymentLink: result.paymentLink,
      transId: result.transId,
    });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Payment initiation failed",
      },
      {
        status: 400,
      },
    );
  }
}
import { NextResponse } from "next/server";

import { FapshiService } from "@/lib/fapshi/fapshi-service";
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

    const result = await FapshiService.createPaymentLink(
      user.id,
      validated.amount,
      validated.phone,
    );

    return NextResponse.json({
      success: true,
      paymentLink: result.paymentLink,
      transId: result.transId,
    });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Payment initiation failed",
      },
      {
        status: 400,
      },
    );
  }
}
