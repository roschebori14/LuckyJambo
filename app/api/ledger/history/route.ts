import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LedgerService } from "@/lib/wallet/ledger-service";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const entries = await LedgerService.getHistory(user.id, 50);
    return NextResponse.json({ success: true, entries });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to fetch ledger" }, { status: 500 });
  }
}
