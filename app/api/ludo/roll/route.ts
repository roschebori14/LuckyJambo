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

    // The die roll and the legal-move computation both happen inside
    // this RPC with Postgres's own random() - nothing here for a
    // tampered client to influence (see migration 057_ludo.sql).
    const { data, error } = await supabase.rpc("roll_ludo_dice", {
      p_match_id: validated.match_id,
    });

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Roll failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
