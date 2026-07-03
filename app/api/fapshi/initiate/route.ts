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

    // NEXT_PUBLIC_APP_URL is the canonical override, but if it's unset
    // (or misconfigured) the redirect back from Fapshi should still
    // land on this deployment rather than silently building a relative
    // URL that Fapshi can't do anything useful with.
    const origin = new URL(request.url).origin;

    const result = await FapshiService.createPaymentLink(
      user.id,
      validated.amount,
      validated.phone,
      origin,
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
