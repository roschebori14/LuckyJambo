import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getChatCompletion } from "@/lib/ai/groq-client";
import { MATCH_HINT_PROMPT } from "@/lib/ai/prompts";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { z } from "zod";

const requestSchema = z.object({
  matchId: z.string().uuid(),
});

// Brief per-game state-shape primers so the model can actually read
// our JSON rather than guessing at field names. Instant single-shot
// games (rock-paper-scissors, coin flip, dice) are deliberately
// omitted - there's no "where should I move" for a single simultaneous
// choice, so a hint there wouldn't mean anything.
const STATE_SHAPE_PRIMERS: Record<string, string> = {
  chess: `State is a FEN string in "fen", plus "current_turn" ('w'/'b').`,
  "tic-tac-toe": `State has "board": 9 cells (index 0-8, row-major, null/'X'/'O') and "current_turn" ('X'/'O').`,
  draughts: `State has "board": an 8x8-ish mapping of square number -> 'r'/'b' (piece present) and "current_turn" ('r'/'b'). Standard draughts/checkers rules (forced captures, kinging on the back row).`,
  "four-in-a-row": `State has "cells": 42 cells (6 rows x 7 cols, row-major, index 0 = top-left) with 'R'/'Y'/null, and "current_turn".`,
  "dots-and-boxes": `State has "h_lines" (20: 5 rows x 4 cols of horizontal lines), "v_lines" (20: 4 rows x 5 cols of vertical lines), "box_owners" (16 boxes, 4x4 grid), "scores": {R,Y}, and "current_turn". Completing a box earns another turn.`,
  "word-chain": `State has the word history so far and whose turn it is - each new word must start with the last letter of the previous word and not have been used yet.`,
  battleship: `State has each player's shot grids and remaining ship counts; "current_turn" is a user id.`,
  "snakes-ladders": `State has each player's position (0-100) and "current_turn" (a user id) - this is dice-driven with no real move choice, so just describe the race situation.`,
  ludo: `State has "tokens": {user_id: [4 relative positions]} where -1 = in yard, 0-50 = on the shared 52-square path relative to that color's own start, 51-56 = home stretch, 57 = home/finished. "colors" maps user_id -> red/green/yellow/blue. "dice_value" is the current roll (null if not yet rolled this turn) and "current_turn" is a user id. A 6 is needed to leave the yard; landing exactly on an opponent's single token sends it back to their yard unless the square is safe; a token must land exactly on 57 (no overshoot).`,
};

const NO_HINT_GAMES = new Set(["rock_paper_scissors", "coin_flip", "dice"]);

async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return user;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // This, and the match_participants check below, are the actual
  // authorization checks - the UI only ever shows this feature to
  // admins who aren't in the match, but that's just UI polish.
  // Without server-side enforcement, any signed-in user could call
  // this route directly and get live move advice on a real-money
  // match, which is exactly the fairness problem this feature must
  // never create.
  const user = await requireAdminUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Not available" }, { status: 403 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
  }

  // Critical: an admin account is not automatically a disinterested
  // party. If this admin is one of the two people staking money on
  // this specific match, a hint here is a direct integrity violation
  // against their opponent - the same "unfair advantage" the platform
  // refuses to give regular players (see SUPPORT_ASSISTANT_PROMPT),
  // just laundered through the admin panel. Block it unconditionally,
  // independent of the rate limit / match-lookup checks below, and
  // before spending an AI call on it.
  const { data: selfParticipation } = await supabase
    .from("match_participants")
    .select("user_id")
    .eq("match_id", body.matchId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selfParticipation) {
    return NextResponse.json(
      { success: false, message: "Hints aren't available for matches you're playing in." },
      { status: 403 },
    );
  }

  const rateCheck = await checkAiRateLimit(user.id, "match_hint", body.matchId);
  if (!rateCheck.allowed) {
    return NextResponse.json({ success: false, message: rateCheck.message }, { status: 429 });
  }

  const { data: match } = await supabase
    .from("matches")
    .select("id, status, game_state, games(slug, name)")
    .eq("id", body.matchId)
    .single();

  if (!match) {
    return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
  }

  if (match.status !== "active") {
    return NextResponse.json({ success: false, message: "This match isn't currently in progress" }, { status: 400 });
  }

  const game = match.games as unknown as { slug: string; name: string } | null;
  const gameSlug = game?.slug ?? "";

  if (NO_HINT_GAMES.has(gameSlug)) {
    return NextResponse.json({
      success: false,
      message: "This is a single-choice instant game - there's no move to hint at.",
    });
  }

  const primer = STATE_SHAPE_PRIMERS[gameSlug];
  if (!primer) {
    return NextResponse.json({ success: false, message: "Hints aren't available for this game yet" }, { status: 400 });
  }

  try {
    const hint = await getChatCompletion(
      [
        { role: "system", content: MATCH_HINT_PROMPT },
        {
          role: "user",
          content: `Game: ${game?.name ?? gameSlug}\nState shape: ${primer}\nCurrent state JSON: ${JSON.stringify(match.game_state)}`,
        },
      ],
      { model: "reasoning", temperature: 0.4, maxTokens: 300 },
    );

    return NextResponse.json({ success: true, hint });
  } catch {
    return NextResponse.json({ success: false, message: "Couldn't generate a hint right now, please try again shortly" }, { status: 502 });
  }
}
