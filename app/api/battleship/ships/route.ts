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

    const { data, error } = await supabase.rpc("get_my_battleship_ships", {
      p_match_id: matchId,
    });

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });

    return NextResponse.json({ success: true, ships: data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
