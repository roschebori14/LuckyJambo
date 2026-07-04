import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  // CRITICAL: this route previously had no authorization check at all.
  // The /admin/users *page* is gated by requireAdmin() in
  // app/admin/layout.tsx, but that only protects rendering the page -
  // this API route is independently reachable and was returning every
  // column (select("*")) of up to 100 profile rows to any
  // authenticated caller, admin or not, because RLS separately allows
  // any logged-in user to read profile rows (migration 012, needed
  // for friend search / matchmaking). requireAdmin() closes that gap
  // the same way /api/admin/verify and /api/admin/withdrawals/action
  // already do it correctly.
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
