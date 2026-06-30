import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TicTacToeEngine } from "@/lib/games/tic-tac-toe-engine";
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
      p_game_slug: "tic-tac-toe",
      p_stake_amount: validated.stake_amount,
    });

    if (error) throw error;

    const initialState = TicTacToeEngine.createGame();

    await supabase
      .from("matches")
      .update({
        game_state: {
          ...initialState,
          x_player_id: user.id,
          o_player_id: null,
        },
      })
      .eq("id", match.id);

    return NextResponse.json({ success: true, match });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create match";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
