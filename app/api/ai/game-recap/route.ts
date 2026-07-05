import { createClient } from "@/lib/supabase/server";
import { getChatCompletion } from "@/lib/ai/groq-client";
import { CHESS_RECAP_PROMPT } from "@/lib/ai/prompts";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { z } from "zod";

const requestSchema = z.object({
  matchId: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return Response.json({ success: false, message: "Invalid request" }, { status: 400 });
  }

  const rateCheck = await checkAiRateLimit(user.id, "game_recap", body.matchId);
  if (!rateCheck.allowed) {
    return Response.json({ success: false, message: rateCheck.message }, { status: 429 });
  }

  // Only participants can request a recap, and only for a settled
  // match - never for a match that's still in progress, so this can
  // never be used to get live assistance on an active wagered game.
  const { data: match } = await supabase
    .from("matches")
    .select("id, status, game_state, games(slug)")
    .eq("id", body.matchId)
    .single();

  if (!match) {
    return Response.json({ success: false, message: "Match not found" }, { status: 404 });
  }

  const gameSlug = (match.games as unknown as { slug: string } | null)?.slug;
  if (gameSlug !== "chess") {
    return Response.json({ success: false, message: "Recaps are only available for chess right now" }, { status: 400 });
  }

  if (match.status !== "completed") {
    return Response.json({ success: false, message: "Recap is only available once the match has finished" }, { status: 400 });
  }

  const { data: participant } = await supabase
    .from("match_participants")
    .select("user_id")
    .eq("match_id", body.matchId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) {
    return Response.json({ success: false, message: "You weren't part of this match" }, { status: 403 });
  }

  const gameState = match.game_state as Record<string, unknown> | null;
  const pgn = typeof gameState?.pgn === "string" ? gameState.pgn : "";

  if (!pgn.trim()) {
    return Response.json({ success: false, message: "No move history was recorded for this match" }, { status: 400 });
  }

  const { data: matchRow } = await supabase
    .from("matches")
    .select("winner_id")
    .eq("id", body.matchId)
    .single();

  const side = (gameState?.white_player_id === user.id) ? "white" : "black";
  const outcome = !matchRow?.winner_id ? "draw" : matchRow.winner_id === user.id ? "win" : "loss";

  try {
    const recap = await getChatCompletion(
      [
        { role: "system", content: CHESS_RECAP_PROMPT },
        { role: "user", content: `PGN: ${pgn}\nPlayer's side: ${side}\nOutcome for this player: ${outcome}` },
      ],
      { model: "reasoning", temperature: 0.5, maxTokens: 400 },
    );

    return Response.json({ success: true, recap });
  } catch {
    return Response.json({ success: false, message: "Couldn't generate a recap right now, please try again shortly" }, { status: 502 });
  }
}
