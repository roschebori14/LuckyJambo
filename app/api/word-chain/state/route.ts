import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyPendingTimeout } from "@/lib/games/word-chain/timeout";
import type { WordChainState } from "@/types/word-chain";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("match_id");
    if (!matchId) return NextResponse.json({ success: false, message: "match_id required" }, { status: 400 });

    const { data, error } = await supabase
      .from("matches").select("*").eq("id", matchId).single();

    if (error || !data) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

    let state = data.game_state as WordChainState;

    // Auto-apply any pending turn timeout so reconnecting players
    // (or the 3s poll) don't leave expired turns stuck forever.
    if (data.status === "active" && !state.game_over) {
      const afterTimeout = await applyPendingTimeout(supabase, matchId, state);
      if (afterTimeout) state = afterTimeout;
    }

    return NextResponse.json({
      success: true,
      match: data,
      state,
      server_time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
