import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createInitialState } from "@/lib/games/word-rush/engine";
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

    const { data: match, error } = await supabase.rpc("create_match", {
      p_game_slug: "word-rush",
      p_stake_amount: validated.stake_amount,
    });

    if (error) throw error;

    // create_match seeds a placeholder game_state (empty letters) - the
    // actual random scramble is only ever decided here, once, in TS
    // (see lib/games/word-rush/engine.ts's generateScramble), same
    // "overwrite immediately after creation" pattern word-chain's
    // create route uses so the SQL and TypeScript shapes can't drift
    // silently out of sync.
    const initialState = createInitialState(user.id);

    await supabase
      .from("matches")
      .update({ game_state: initialState })
      .eq("id", match.id);

    return NextResponse.json({ success: true, match });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create match";
    console.error("Word Rush match creation failed", { message, error });
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
