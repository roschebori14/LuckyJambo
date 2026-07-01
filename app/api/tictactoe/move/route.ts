import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TicTacToeEngine } from "@/lib/games/tic-tac-toe-engine";
import { z } from "zod";

const schema = z.object({
  match_id: z.string().uuid(),
  cell_index: z.number().int().min(0).max(8),
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

    const state = match.game_state as {
      board: Array<"X" | "O" | null>;
      current_turn: "X" | "O";
      winner: string | null;
      is_draw: boolean;
      game_over: boolean;
      x_player_id: string;
      o_player_id: string;
    };

    const isX = state.x_player_id === user.id;
    const isO = state.o_player_id === user.id;
    if (!isX && !isO) {
      return NextResponse.json({ success: false, message: "Not a participant" }, { status: 403 });
    }
    if ((state.current_turn === "X" && !isX) || (state.current_turn === "O" && !isO)) {
      return NextResponse.json({ success: false, message: "Not your turn" }, { status: 400 });
    }

    const newState = TicTacToeEngine.makeMove(state as unknown as Parameters<typeof TicTacToeEngine.makeMove>[0], validated.cell_index);
    const fullState = { ...newState, x_player_id: state.x_player_id, o_player_id: state.o_player_id };

    const updatePayload: Record<string, unknown> = { game_state: fullState };

    if (newState.game_over) {
      updatePayload.status = "completed";
      if (newState.winner) {
        const winnerId = newState.winner === "X" ? state.x_player_id : state.o_player_id;
        updatePayload.winner_id = winnerId;
        await supabase.rpc("settle_match", {
          p_match_id: validated.match_id,
          p_winner_id: winnerId,
        });
      } else {
        // Draw – refund both
        await supabase.rpc("apply_wallet_transaction", {
          p_user_id: state.x_player_id, p_type: "refund",
          p_amount: match.stake_amount, p_reference: match.id,
          p_description: "Tic Tac Toe draw - stake refunded",
        });
        await supabase.rpc("apply_wallet_transaction", {
          p_user_id: state.o_player_id, p_type: "refund",
          p_amount: match.stake_amount, p_reference: match.id,
          p_description: "Tic Tac Toe draw - stake refunded",
        });
      }
    }

    await supabase.from("matches").update(updatePayload).eq("id", validated.match_id);

    return NextResponse.json({ success: true, state: fullState });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
