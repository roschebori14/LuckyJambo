import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

    const newState: Record<string, unknown> = {
      ...state,
      fen: chess.fen(),
      pgn: chess.pgn(),
      current_turn: chess.turn(),
    };

    let updatePayload: Record<string, unknown> = { game_state: newState };

    if (chess.isGameOver()) {
      updatePayload.status = "completed";
      if (chess.isCheckmate()) {
        // The side that just moved is the winner
        const winnerId = chess.turn() === "w" ? state.black_player_id : state.white_player_id;
        updatePayload.winner_id = winnerId;

        await supabase.rpc("settle_match", {
          p_match_id: validated.match_id,
          p_winner_id: winnerId,
        });
      } else {
        // Draw - refund both players
        await supabase.rpc("apply_wallet_transaction", {
          p_user_id: state.white_player_id,
          p_type: "refund",
          p_amount: match.stake_amount,
          p_reference: match.id,
          p_description: "Chess draw - stake refunded",
        });
        await supabase.rpc("apply_wallet_transaction", {
          p_user_id: state.black_player_id,
          p_type: "refund",
          p_amount: match.stake_amount,
          p_reference: match.id,
          p_description: "Chess draw - stake refunded",
        });
      }
    }

    await supabase.from("matches").update(updatePayload).eq("id", validated.match_id);

    return NextResponse.json({
      success: true,
      move,
      fen: chess.fen(),
      game_over: chess.isGameOver(),
      checkmate: chess.isCheckmate(),
      draw: chess.isDraw(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
