import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateShotInput, applyShot } from "@/lib/games/archery/engine";
import type { ArcheryState, ArcheryShotInput } from "@/types/archery";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    // Only the raw aim gesture is accepted from the client - no
    // landing position or score. Those are always derived server-side
    // in applyShot, from this input plus the wind/distance the server
    // itself generated (see lib/games/archery/engine.ts).
    const { matchId, input } = body as {
      matchId: string;
      input: ArcheryShotInput;
    };

    if (!matchId || !input) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch current state
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (match.status !== "active") {
      return NextResponse.json({ error: "Match is not active" }, { status: 400 });
    }

    const state = match.game_state as ArcheryState;
    if (state.game_type !== "archery") {
      return NextResponse.json({ error: "Not an archery match" }, { status: 400 });
    }

    const validation = validateShotInput(state, user.id, input);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const newState = applyShot(state, user.id, input);

    const isGameOver = newState.game_over;
    const winner = newState.winner;

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "apply_archery_shot_result",
      {
        p_match_id: matchId,
        p_expected_updated_at: match.updated_at,
        p_new_state: newState,
        p_winner: winner,
        p_game_over: isGameOver,
      }
    );

    if (rpcError) {
      console.error("RPC Error:", rpcError);
      return NextResponse.json(
        { error: "State changed, please retry" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, gameState: rpcData.game_state });
  } catch (error) {
    console.error("Archery shot error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
