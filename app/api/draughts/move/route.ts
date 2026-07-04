import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DraughtsEngine, DraughtsState } from "@/lib/games/draughts-engine";
import { z } from "zod";

const moveSchema = z.object({
  match_id: z.string().uuid(),
  from: z.number().int().min(1).max(32),
  to: z.number().int().min(1).max(32),
  captures: z.array(z.number().int().min(1).max(32)).default([]),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const validated = moveSchema.parse(body);

    const { data: match, error: fetchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", validated.match_id)
      .single();

    if (fetchError || !match) {
      return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
    }

    if (match.status !== "active") {
      return NextResponse.json({ success: false, message: "Match is not active" }, { status: 400 });
    }

    const state = match.game_state as DraughtsState;

    const isR = state.r_player_id === user.id;
    const isB = state.b_player_id === user.id;
    if (!isR && !isB) {
      return NextResponse.json({ success: false, message: "Not a participant" }, { status: 403 });
    }
    if ((state.current_turn === "r" && !isR) || (state.current_turn === "b" && !isB)) {
      return NextResponse.json({ success: false, message: "Not your turn" }, { status: 400 });
    }

    let newState: DraughtsState;
    try {
      newState = DraughtsEngine.makeMove(state, {
        from: validated.from,
        to: validated.to,
        captures: validated.captures,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Illegal move";
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    // Persistence + settlement happen atomically in the DB (same
    // reasoning as chess/tic-tac-toe: a direct table update from the
    // player's own session silently writes nothing, since there's no
    // RLS UPDATE policy on matches).
    const { data: rpcData, error: rpcError } = await supabase.rpc("apply_draughts_move_result", {
      p_match_id: validated.match_id,
      p_expected_board: state.board,
      p_new_board: newState.board,
      p_new_turn: newState.current_turn,
      p_game_over: newState.game_over,
      p_winner: newState.winner,
    });

    if (rpcError) {
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, state: rpcData?.game_state ?? newState });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
