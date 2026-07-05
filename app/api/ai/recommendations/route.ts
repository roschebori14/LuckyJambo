import { createClient } from "@/lib/supabase/server";
import { getChatCompletion } from "@/lib/ai/groq-client";
import { RECOMMENDATION_PROMPT } from "@/lib/ai/prompts";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";

interface RecommendationResult {
  suggested_game_slug: string;
  suggested_game_reason: string;
  suggested_opponent_username: string | null;
  suggested_opponent_reason: string | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const rateCheck = await checkAiRateLimit(user.id, "recommendations", "dashboard suggestion");
  if (!rateCheck.allowed) {
    return Response.json({ success: false, message: rateCheck.message }, { status: 429 });
  }

  const [{ data: games }, { data: recentMatches }, { data: friendRows }, { data: topPlayers }] = await Promise.all([
    supabase.from("games").select("slug, name").eq("is_active", true),
    supabase
      .from("match_participants")
      .select("matches(game_id, games(slug))")
      .eq("user_id", user.id)
      .limit(30),
    supabase.from("friends").select("friend_id, profiles!friends_friend_id_fkey(username)").eq("user_id", user.id).limit(10),
    supabase.rpc("get_leaderboard_wins", { p_limit: 10 }),
  ]);

  if (!games || games.length === 0) {
    return Response.json({ success: false, message: "No games available to recommend" }, { status: 400 });
  }

  // Tally how often each game slug appears in this user's match history.
  const playCounts = new Map<string, number>();
  for (const row of recentMatches ?? []) {
    const slug = (row as unknown as { matches: { games: { slug: string } | null } | null }).matches?.games?.slug;
    if (slug) playCounts.set(slug, (playCounts.get(slug) ?? 0) + 1);
  }

  const friends = (friendRows ?? [])
    .map(f => (f as unknown as { profiles: { username: string } | null }).profiles?.username)
    .filter((u): u is string => !!u);

  const otherPlayers = ((topPlayers ?? []) as { user_id: string; username: string; wins: number }[])
    .filter(p => p.user_id !== user.id)
    .map(p => p.username)
    .slice(0, 8);

  const context = {
    available_games: games.map(g => g.slug),
    play_counts_by_game_slug: Object.fromEntries(playCounts),
    friends,
    other_active_players: otherPlayers,
  };

  try {
    const raw = await getChatCompletion(
      [
        { role: "system", content: RECOMMENDATION_PROMPT },
        { role: "user", content: JSON.stringify(context) },
      ],
      { model: "fast", temperature: 0.7, maxTokens: 200 },
    );

    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as RecommendationResult;

    if (!games.some(g => g.slug === parsed.suggested_game_slug)) {
      throw new Error("model suggested an invalid game slug");
    }

    return Response.json({ success: true, ...parsed });
  } catch {
    return Response.json({ success: false, message: "Couldn't generate a suggestion right now" }, { status: 502 });
  }
}
