import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  match_id: z.string().uuid(),
});

// Called by either player's client once the shared round countdown
// (derived from state.round_started_at + state.round_seconds) hits
// zero - not just one side, since either player noticing first should
// be enough to lock the round. apply_word_rush_end_round re-derives
// the deadline from the match row itself (locked FOR UPDATE) rather
// than trusting anything this request claims, so a stale/duplicate/
// early call just fails with a 400 the client can ignore.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const { match_id } = schema.parse(body);

    const { data, error } = await supabase.rpc("apply_word_rush_end_round", {
      p_match_id: match_id,
    });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, state: data?.game_state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "End-of-round report failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
