import { NextResponse } from "next/server";

import { validateWebhook } from "@/lib/fapshi/webhook-validator";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const valid = validateWebhook(payload);

    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid webhook",
        },
        {
          status: 400,
        },
      );
    }

    console.log("Fapshi webhook received", payload);

    return NextResponse.json({
      success: true,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      },
    );
  }
}
