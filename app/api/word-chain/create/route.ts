import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createInitialState } from "@/lib/games/word-chain/engine";
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
      p_game_slug: "word-chain",
      p_stake_amount: validated.stake_amount,
    });

    if (error) throw error;

    // create_match already seeds the correct initial game_state for this
    // slug (see migration 053_word_chain.sql) - overwriting explicitly
    // here too guarantees the SQL and TypeScript shapes can never drift
    // silently out of sync, same reasoning as the four-in-a-row route.
    const initialState = createInitialState(user.id);

    await supabase
      .from("matches")
      .update({ game_state: initialState })
      .eq("id", match.id);

    return NextResponse.json({ success: true, match });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create match";
    console.error("Word Chain match creation failed", { message, error });
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
