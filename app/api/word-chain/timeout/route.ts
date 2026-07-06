import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  match_id: z.string().uuid(),
});

// Called by either player's client once the shared turn countdown
// (derived from state.turn_started_at + state.turn_seconds) hits zero
// - not just the player who's actually on the clock, since the whole
// point of a timer is to stop someone from stalling on purpose. The
// apply_word_chain_timeout RPC re-derives everything from the match
// row itself (locked FOR UPDATE) rather than trusting anything this
// request claims, so a stale/duplicate/early call just fails with a
// 400 the client can ignore instead of double-applying a strike.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const { match_id } = schema.parse(body);

    const { data, error } = await supabase.rpc("apply_word_chain_timeout", {
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
    const message = error instanceof Error ? error.message : "Timeout report failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
