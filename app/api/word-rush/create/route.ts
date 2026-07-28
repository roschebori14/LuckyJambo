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

    // create_word_rush_match (073_word_rush_join_fix.sql) runs
    // create_match + letter seed in one transaction so the match is
    // never joinable with an empty letters[] placeholder (the race
    // 068 guarded against, caused by the old two-step create flow).
    const initialState = createInitialState(user.id);

    const { data: match, error } = await supabase.rpc("create_word_rush_match", {
      p_stake_amount: validated.stake_amount,
      p_state: initialState,
      p_invited_user_id: validated.invited_user_id ?? null,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, match: { ...match, game_state: initialState } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create match";
    console.error("Word Rush match creation failed", { message, error });
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
