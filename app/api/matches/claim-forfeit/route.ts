import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ match_id: z.string().uuid() });

// Timeout varies by game type: instant games (RPS/dice/coin) should
// never sit "active" for long since both players just submit one move,
// so a short timeout catches an abandoned game fast. Turn-based games
// (chess/draughts/tic-tac-toe) can legitimately take hours between
// moves for casual play, so they get a longer window.
const TURN_BASED_SLUGS = ["chess", "draughts", "tic-tac-toe"];
const INSTANT_TIMEOUT_MINUTES = 15;
const TURN_BASED_TIMEOUT_MINUTES = 120;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const validated = schema.parse(body);

    const { data: match } = await supabase
      .from("matches")
      .select("*, games(slug)")
      .eq("id", validated.match_id)
      .single();

    if (!match) return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });

    const slug = (match.games as { slug: string } | null)?.slug ?? "";
    const timeoutMinutes = TURN_BASED_SLUGS.includes(slug) ? TURN_BASED_TIMEOUT_MINUTES : INSTANT_TIMEOUT_MINUTES;

    const { data, error } = await supabase.rpc("claim_forfeit_win", {
      p_match_id: validated.match_id,
      p_timeout_minutes: timeoutMinutes,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, match: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not claim forfeit";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
