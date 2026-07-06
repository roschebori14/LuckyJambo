import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ stake_amount: z.number().positive() });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const body = await request.json();
    const validated = schema.parse(body);

    // create_match (migration 051_dots_and_boxes.sql) already seeds the
    // correct initial game_state for this slug server-side - no
    // follow-up client-session write needed (and none would work: there
    // is intentionally no RLS UPDATE policy on `matches`).
    const { data: match, error } = await supabase.rpc("create_match", {
      p_game_slug: "dots-and-boxes",
      p_stake_amount: validated.stake_amount,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, match });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create match";
    console.error("Dots and Boxes match creation failed", { message, error });
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
