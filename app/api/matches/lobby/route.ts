import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLobbyData } from "@/lib/matchmaking/lobby-service";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const data = await getLobbyData(user.id);
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load lobby";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
