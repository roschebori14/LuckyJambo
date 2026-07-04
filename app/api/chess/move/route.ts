import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const moveSchema = z.object({
  match_id: z.string().uuid(),
  from: z.string().length(2),
  to: z.string().length(2),
  promotion: z.string().optional().default("q"),
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

    const state = match.game_state as {
      fen: string;
      pgn: string;
      current_turn: string;
      white_player_id: string;
      black_player_id: string;
    };

    // Enforce turn order
    const isWhite = state.white_player_id === user.id;
    const isBlack = state.black_player_id === user.id;
    if (!isWhite && !isBlack) {
      return NextResponse.json({ success: false, message: "Not a participant" }, { status: 403 });
    }
    if ((state.current_turn === "w" && !isWhite) || (state.current_turn === "b" && !isBlack)) {
      return NextResponse.json({ success: false, message: "Not your turn" }, { status: 400 });
    }

    const chess = new Chess(state.fen);
    const move = chess.move({ from: validated.from, to: validated.to, promotion: validated.promotion });

    if (!move) {
      return NextResponse.json({ success: false, message: "Illegal move" }, { status: 400 });
    }

    const isDraw = chess.isGameOver() && !chess.isCheckmate();

    // Persistence + settlement happen atomically in the DB via a
    // SECURITY DEFINER RPC. Direct `supabase.from("matches").update()`
    // from the player's own session silently affects 0 rows (there is
    // intentionally no RLS UPDATE policy on matches, to stop players
    // rewriting stakes/winners directly) - this RPC is the real write
    // path and re-validates turn order / match state server-side.
    const { data: rpcData, error: rpcError } = await supabase.rpc("apply_chess_move_result", {
      p_match_id: validated.match_id,
      p_expected_fen: state.fen,
      p_new_fen: chess.fen(),
      p_new_pgn: chess.pgn(),
      p_new_turn: chess.turn(),
      p_is_checkmate: chess.isCheckmate(),
      p_is_draw: isDraw,
    });

    if (rpcError) {
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      move,
      fen: chess.fen(),
      game_over: chess.isGameOver(),
      checkmate: chess.isCheckmate(),
      draw: chess.isDraw(),
      game_state: rpcData?.game_state,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
