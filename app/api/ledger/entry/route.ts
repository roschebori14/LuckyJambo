// This endpoint is reserved for admin use only.
// Regular ledger entries are created atomically via apply_wallet_transaction RPC.
import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ success: false, message: "Use wallet transaction API" }, { status: 403 });
}
