import { createClient } from "@/lib/supabase/server";
import ActiveMatchBannerClient from "./active-match-banner-client";

/** Shown on every page while the user has a match in progress, so
 *  leaving the match page (or the whole site) never strands them -
 *  the match itself already keeps running server-side regardless
 *  (matches.game_state is persisted in the DB and nothing here ends a
 *  match on disconnect), this is purely about making it easy to find
 *  your way back in. */
export default async function ActiveMatchBanner({ userId }: { userId: string }) {
  if (!userId) return null;

  const supabase = await createClient();

  const { data: participantRows } = await supabase
    .from("match_participants")
    .select("match_id")
    .eq("user_id", userId);

  const matchIds = (participantRows ?? []).map((r) => r.match_id);
  if (matchIds.length === 0) return null;

  const { data: activeMatches } = await supabase
    .from("matches")
    .select("id, stake_amount, games(name, slug)")
    .in("id", matchIds)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(5);

  const matches = (activeMatches ?? [])
    .map((m) => {
      const game = m.games as unknown as { name: string; slug: string } | null;
      if (!game) return null;
      return {
        id: m.id,
        gameName: game.name,
        gameSlug: game.slug,
        stakeAmount: m.stake_amount as number,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  if (matches.length === 0) return null;

  return <ActiveMatchBannerClient matches={matches} />;
}
