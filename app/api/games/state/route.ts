import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Instant games (RPS, coin flip, dice) resolve as soon as both players
// have submitted a move, entirely server-side inside submit_instant_move.
// The client only tracks "have I submitted?" / "is there a result?" in
// local React state, which is lost on every reload - so a player who
// submits their move, then closes the tab or refreshes while waiting
// for their opponent, lands back on the move-selection screen instead
// of "waiting for opponent" or the final result. This endpoint lets the
// client re-derive that state from the database on mount instead of
// trusting a client-only flag.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("match_id");
    if (!matchId) return NextResponse.json({ success: false, message: "match_id required" }, { status: 400 });

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, status, winner_id, game_state")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
    }

    if (match.status === "completed") {
      const outcome = (match.game_state as { outcome?: string } | null)?.outcome;
      if (outcome === "draw" || !match.winner_id) {
        return NextResponse.json({ success: true, result: { status: "draw" } });
      }
      return NextResponse.json({
        success: true,
        result: { status: "resolved", winner_id: match.winner_id, you_won: match.winner_id === user.id },
      });
    }

    const { data: myMove } = await supabase
      .from("match_moves")
      .select("move")
      .eq("match_id", matchId)
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      result: myMove ? { status: "submitted", move: myMove.move } : { status: "not_submitted" },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Could not load game state" }, { status: 500 });
  }
}
