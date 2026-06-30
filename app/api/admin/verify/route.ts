import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    await requireAdmin();

    return NextResponse.json({
      success: true,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 403,
      },
    );
  }
}
