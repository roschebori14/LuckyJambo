import "server-only";
import { createClient } from "@/lib/supabase/server";
import { FriendService } from "@/lib/friends/friend-service";

export interface LobbyMatch {
  id: string;
  gameName: string;
  gameSlug: string;
  creatorName: string;
  stakeAmount: number;
  status: string;
  isOwn: boolean;
  isParticipant?: boolean;
}

export interface LobbyData {
  openMatches: LobbyMatch[];
  liveMatches: LobbyMatch[];
}

/**
 * Enrichment logic for the two match lists on the Matchmaking page
 * (open + active) - pulled out of app/(protected)/matches/page.tsx so
 * both the initial server-rendered page load and
 * app/api/matches/lobby/route.ts (used to refresh the lists on a
 * realtime event, see hooks/use-matches-lobby-realtime.ts) call the
 * exact same code and can never quietly drift into two different
 * shapes for the same two lists.
 */
export async function getLobbyData(userId: string): Promise<LobbyData> {
  const supabase = await createClient();

  const [{ data: matches }, { data: activeMatches }] = await Promise.all([
    supabase
      .from("matches")
      .select("id, stake_amount, status, created_at, creator_id, invited_user_id, games(name, slug)")
      .eq("status", "waiting")
      // See the original comment in page.tsx: matches RLS allows
      // reading every waiting/active/completed row, so without this
      // filter a private friend challenge would show up in everyone's
      // open-matches list even though join_match blocks anyone but the
      // invited friend from actually joining it.
      .or(`invited_user_id.is.null,invited_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("matches")
      .select("id, stake_amount, status, created_at, creator_id, games(name, slug)")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);

  const creatorIds = [...(matches ?? []), ...(activeMatches ?? [])].map((m) => m.creator_id).filter(Boolean);
  const profileIds = Array.from(new Set(creatorIds));
  const usernameById = await FriendService.getProfilesById(profileIds);

  const activeMatchIds = (activeMatches ?? []).map((m) => m.id);
  const { data: myParticipantRows } = activeMatchIds.length
    ? await supabase
        .from("match_participants")
        .select("match_id")
        .eq("user_id", userId)
        .in("match_id", activeMatchIds)
    : { data: [] as { match_id: string }[] };
  const myActiveMatchIds = new Set((myParticipantRows ?? []).map((r) => r.match_id));

  const openMatches: LobbyMatch[] = (matches ?? []).map((m) => ({
    id: m.id,
    gameName: (m.games as unknown as { name: string } | null)?.name ?? "Game",
    gameSlug: (m.games as unknown as { slug: string } | null)?.slug ?? "",
    creatorName: usernameById.get(m.creator_id)?.username ?? "Player",
    stakeAmount: m.stake_amount,
    status: m.status,
    isOwn: m.creator_id === userId,
  }));

  const liveMatches: LobbyMatch[] = (activeMatches ?? []).map((m) => ({
    id: m.id,
    gameName: (m.games as unknown as { name: string } | null)?.name ?? "Game",
    gameSlug: (m.games as unknown as { slug: string } | null)?.slug ?? "",
    creatorName: usernameById.get(m.creator_id)?.username ?? "Player",
    stakeAmount: m.stake_amount,
    status: m.status,
    isOwn: m.creator_id === userId,
    isParticipant: myActiveMatchIds.has(m.id),
  }));

  return { openMatches, liveMatches };
}
