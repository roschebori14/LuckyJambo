import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await requireAuth();

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("wallet_ledger")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      transactions: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to load transaction history",
      },
      {
        status: 500,
      },
    );
  }
}
