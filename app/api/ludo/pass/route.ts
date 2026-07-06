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

    // Only actually succeeds server-side once the match has been idle
    // for a couple of minutes (see pass_ludo_turn in 057_ludo.sql) -
    // this just skips the stuck seat's turn, it never ends the match
    // or touches anyone's stake.
    const { data, error } = await supabase.rpc("pass_ludo_turn", {
      p_match_id: validated.match_id,
    });

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });

    return NextResponse.json({ success: true, match: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to pass turn";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
