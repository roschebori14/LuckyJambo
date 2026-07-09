import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyShot, PoolRulesError } from "@/lib/games/pool/engine";
import type { PoolState } from "@/types/pool";
import { z } from "zod";

const schema = z.object({
  match_id: z.string().uuid(),
  final_positions: z.array(
    z.object({ id: z.number().int(), x: z.number(), y: z.number(), pocketed: z.boolean() })
  ),
  first_contact_ball_id: z.number().int().nullable(),
  cue_pocketed: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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

    const state = match.game_state as PoolState;
    const seat = state.a_player_id === user.id ? "A" : "B";
    if (state.a_player_id !== user.id && state.b_player_id !== user.id) {
      return NextResponse.json({ success: false, message: "Not a participant" }, { status: 403 });
    }

    let outcome;
    try {
      outcome = applyShot(state, seat, {
        final_positions: validated.final_positions,
        first_contact_ball_id: validated.first_contact_ball_id,
        cue_pocketed: validated.cue_pocketed,
      });
    } catch (err) {
      if (err instanceof PoolRulesError) {
        return NextResponse.json({ success: false, message: err.message }, { status: 400 });
      }
      throw err;
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc("apply_pool_shot_result", {
      p_match_id: validated.match_id,
      p_expected_updated_at: match.updated_at,
      p_new_state: outcome.state,
      p_winner: outcome.state.winner,
      p_game_over: outcome.state.game_over,
    });

    if (rpcError) {
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      state: rpcData?.game_state,
      foul: outcome.foul,
      foul_reason: outcome.foulReason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shot failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
