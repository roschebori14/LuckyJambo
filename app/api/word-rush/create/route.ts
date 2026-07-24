import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createInitialState } from "@/lib/games/word-rush/engine";
import { z } from "zod";

const schema = z.object({
  stake_amount: z.number().positive(),
  invited_user_id: z.string().uuid().optional(),
});

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

    const { data: match, error } = await supabase.rpc("create_match", {
      p_game_slug: "word-rush",
      p_stake_amount: validated.stake_amount,
      p_invited_user_id: validated.invited_user_id ?? null,
    });

    if (error) throw error;

    // create_match seeds a placeholder game_state (empty letters) -
    // the actual random scramble is only ever decided here, once, in
    // TS (see lib/games/word-rush/engine.ts's generateScramble). This
    // used to be persisted with a raw
    // `supabase.from("matches").update(...)` from the player's own
    // session, which silently wrote 0 rows (no RLS UPDATE policy on
    // `matches` - see migration 067_word_rush_fixes.sql for the full
    // story, same gap 065 already hit for eight-ball-pool's rack).
    // seed_word_rush_letters is a security-definer RPC scoped
    // narrowly to "the creator, before anyone's joined, for a
    // word-rush match", so it can actually persist this.
    const initialState = createInitialState(user.id);

    const { error: seedError } = await supabase.rpc("seed_word_rush_letters", {
      p_match_id: match.id,
      p_state: initialState,
    });
    if (seedError) throw seedError;

    return NextResponse.json({ success: true, match: { ...match, game_state: initialState } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create match";
    console.error("Word Rush match creation failed", { message, error });
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
