import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    // The move + win/draw check is computed authoritatively inside
    // this RPC (server-side, from the real DB row) and persisted in
    // the same transaction. The old code computed the result in TS
    // with TicTacToeEngine and then wrote it back with
    // `supabase.from("matches").update(...)` from the player's own
    // session - which silently affected 0 rows (no RLS UPDATE policy
    // on matches), so the move never actually saved. It also called
    // apply_wallet_transaction directly for draw refunds, which
    // migration 017 locked down to service_role only, so draws were
    // silently failing too.
    const { data: rpcData, error: rpcError } = await supabase.rpc("submit_tictactoe_move", {
      p_match_id: validated.match_id,
      p_cell_index: validated.cell_index,
    });

    if (rpcError) {
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, state: rpcData?.state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
