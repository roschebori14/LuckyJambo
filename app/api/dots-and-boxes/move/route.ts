import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyDrawLine, DotsAndBoxesRulesError, type DotsAndBoxesState } from "@/lib/games/dots-and-boxes/engine";
import { z } from "zod";

const schema = z.object({
  match_id: z.string().uuid(),
  line_type: z.enum(["h", "v"]),
  line_index: z.number().int().min(0).max(19),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const validated = schema.parse(body);

    const { data: match } = await supabase
      .from("matches")
      .select("*")
      .eq("id", validated.match_id)
      .single();

    if (!match || match.status !== "active") {
      return NextResponse.json({ success: false, message: "Match not active" }, { status: 400 });
    }

    const state = match.game_state as DotsAndBoxesState;

    // DotsAndBoxesGame.moves.drawLine (the actual boardgame.io rules
    // engine - lib/games/dots-and-boxes/game.ts) decides legality and
    // whether a box was completed; this route just shuttles state in
    // and the validated result out.
    let nextState: DotsAndBoxesState;
    try {
      nextState = applyDrawLine(state, user.id, validated.line_type, validated.line_index);
    } catch (err) {
      if (err instanceof DotsAndBoxesRulesError) {
        return NextResponse.json({ success: false, message: err.message }, { status: 400 });
      }
      throw err;
    }

    // Persistence + settlement happen atomically via a SECURITY
    // DEFINER RPC (no RLS UPDATE policy on `matches` - see every other
    // game's move route for why). Both line arrays are passed as the
    // optimistic-concurrency check since a move can be a horizontal or
    // vertical line and either array could be stale.
    const { data: rpcData, error: rpcError } = await supabase.rpc("apply_dots_and_boxes_move_result", {
      p_match_id: validated.match_id,
      p_expected_h_lines: state.h_lines,
      p_expected_v_lines: state.v_lines,
      p_new_h_lines: nextState.h_lines,
      p_new_v_lines: nextState.v_lines,
      p_new_box_owners: nextState.box_owners,
      p_new_scores: nextState.scores,
      p_new_turn: nextState.current_turn,
      p_winner: nextState.winner,
      p_is_draw: nextState.is_draw,
      p_game_over: nextState.game_over,
    });

    if (rpcError) {
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, state: rpcData?.game_state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
