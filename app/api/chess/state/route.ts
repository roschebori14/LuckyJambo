import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("match_id");

    if (!matchId) {
      return NextResponse.json({ success: false, message: "match_id required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, match: data, game_state: data.game_state });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
