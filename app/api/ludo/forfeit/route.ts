import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ match_id: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const validated = schema.parse(body);

    // Voluntary quit - stake is forfeited to the pot, not refunded
    // (see forfeit_ludo_seat in 058_ludo_fixes.sql). If this leaves
    // only one seat, the match settles immediately in their favor.
    const { data, error } = await supabase.rpc("forfeit_ludo_seat", {
      p_match_id: validated.match_id,
    });

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });

    return NextResponse.json({ success: true, match: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to forfeit";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
