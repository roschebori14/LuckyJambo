import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    // Read from DB so the game list always matches seeds/migrations.
    // Previously used a hardcoded GAME_REGISTRY with fake string IDs
    // ("chess","draughts") that couldn't be inserted as match.game_id
    // (UUID column) and would crash immediately.
    const { data, error } = await supabase
      .from("games")
      .select("id, name, slug, description, min_stake, max_stake, is_active")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    return NextResponse.json({ success: true, games: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load games";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
