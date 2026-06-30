import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  stake_amount: z.number().positive(),
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

    const chess = new Chess();

    // create_match locks the stake, creates the match row + participant.
    // Chess state is stored in matches.game_state (added in migration 005).
    const { data: match, error } = await supabase.rpc("create_match", {
      p_game_slug: "chess",
      p_stake_amount: validated.stake_amount,
    });

    if (error) throw error;

    // Patch in the initial chess state
    await supabase
      .from("matches")
      .update({
        game_state: {
          fen: chess.fen(),
          pgn: "",
          current_turn: "w",
          white_player_id: user.id,
          black_player_id: null,
          status: "waiting",
        },
      })
      .eq("id", match.id);

    return NextResponse.json({ success: true, match });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create chess match";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
