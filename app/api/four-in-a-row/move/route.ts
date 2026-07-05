import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyDropDisc, FourInARowRulesError, type FourInARowState } from "@/lib/games/four-in-a-row/engine";
import { z } from "zod";

const schema = z.object({
  match_id: z.string().uuid(),
  column: z.number().int().min(0).max(6),
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

    const state = match.game_state as FourInARowState;

    // FourInARowGame.moves.dropDisc (the actual boardgame.io rules
    // engine - see lib/games/four-in-a-row/game.ts) is the authority on
    // whether this move is legal and what the resulting board/turn/
    // winner look like. This route just shuttles state in and the
    // validated result out.
    let nextState: FourInARowState;
    try {
      nextState = applyDropDisc(state, user.id, validated.column);
    } catch (err) {
      if (err instanceof FourInARowRulesError) {
        return NextResponse.json({ success: false, message: err.message }, { status: 400 });
      }
      throw err;
    }

    // Persistence + settlement happen atomically in the DB via a
    // SECURITY DEFINER RPC, exactly like chess/draughts/battleship -
    // there is intentionally no RLS UPDATE policy on `matches`, so a
    // player's own session can't rewrite the board, stakes, or winner
    // directly. `p_expected_cells` re-checks the board hasn't changed
    // since this player last read it (optimistic concurrency).
    const { data: rpcData, error: rpcError } = await supabase.rpc("apply_four_in_a_row_move_result", {
      p_match_id: validated.match_id,
      p_expected_cells: state.cells,
      p_new_cells: nextState.cells,
      p_new_column_heights: nextState.column_heights,
      p_new_turn: nextState.current_turn,
      p_winner: nextState.winner,
      p_winning_line: nextState.winning_line,
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
