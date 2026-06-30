import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    if (!slug) return NextResponse.json({ success: false, message: "slug required" }, { status: 400 });

    const { data: game } = await supabase
      .from("games").select("id").eq("slug", slug).single();
    if (!game) return NextResponse.json({ success: false, message: "Game not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("matches")
      .select("id, stake_amount, status, created_at, creator_id")
      .eq("game_id", game.id)
      .eq("status", "waiting")
      .neq("creator_id", user.id)   // don't show your own open matches
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ success: true, matches: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
