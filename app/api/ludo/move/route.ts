import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ match_id: z.string().uuid(), token_index: z.number().int().min(0).max(3) });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const validated = schema.parse(body);

    const { data, error } = await supabase.rpc("move_ludo_token", {
      p_match_id: validated.match_id,
      p_token_index: validated.token_index,
    });

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
