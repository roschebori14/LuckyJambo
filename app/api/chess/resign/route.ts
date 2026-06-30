import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ match_id: z.string().uuid() });

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

    const { data: match } = await supabase
      .from("matches")
      .select("*")
      .eq("id", validated.match_id)
      .single();

    if (!match || match.status !== "active") {
      return NextResponse.json({ success: false, message: "Match not found or not active" }, { status: 404 });
    }

    const state = match.game_state as { white_player_id: string; black_player_id: string };

    if (user.id !== state.white_player_id && user.id !== state.black_player_id) {
      return NextResponse.json({ success: false, message: "Not a participant" }, { status: 403 });
    }

    // The opponent of whoever resigned is the winner
    const winnerId =
      user.id === state.white_player_id ? state.black_player_id : state.white_player_id;

    const { error } = await supabase.rpc("settle_match", {
      p_match_id: validated.match_id,
      p_winner_id: winnerId,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resign failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
