import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("match_id");
    if (!matchId) return NextResponse.json({ success: false, message: "match_id required" }, { status: 400 });

    const { data: match, error } = await supabase
      .from("matches")
      .select("id, status, game_state, winner_id, updated_at")
      .eq("id", matchId)
      .single();

    if (error || !match) {
      return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, match });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load state";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
