import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createInitialState } from "@/lib/games/pool/engine";
import { z } from "zod";

const schema = z.object({ stake_amount: z.number().positive(), invited_user_id: z.string().uuid().optional() });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const validated = schema.parse(body);

    const { data: match, error } = await supabase.rpc("create_match", {
      p_game_slug: "eight-ball-pool",
      p_stake_amount: validated.stake_amount,
      p_invited_user_id: validated.invited_user_id ?? null,
    });

    if (error) throw error;

    // create_match seeds a correctly-shaped placeholder (empty rack) -
    // this call fills in the real shuffled rack. Previously this used
    // a raw `supabase.from("matches").update(...)` from the player's
    // own session, which silently wrote nothing (no RLS UPDATE policy
    // on `matches` - see migration 065_eight_ball_pool_fixes.sql for
    // the full story). seed_pool_rack is a security-definer RPC scoped
    // narrowly to "the creator, before anyone's joined, for a pool
    // match", so it can actually persist this.
    const initialState = createInitialState(user.id);
    const { error: seedError } = await supabase.rpc("seed_pool_rack", {
      p_match_id: match.id,
      p_state: initialState,
    });
    if (seedError) throw seedError;

    return NextResponse.json({ success: true, match: { ...match, game_state: initialState } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create match";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
