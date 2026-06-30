import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, message: "id required" }, { status: 400 });

    const { data, error } = await supabase
      .from("matches").select("id, status, game_state, stake_amount, winner_id, creator_id").eq("id", id).single();

    if (error || !data) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, match: data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
