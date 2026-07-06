import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { FriendService } from "@/lib/friends/friend-service";
import { getLobbyData } from "@/lib/matchmaking/lobby-service";
import CreateMatchForm from "@/components/matches/create-match-form";
import ChallengeFriendForm from "@/components/matches/challenge-friend-form";
import MatchesLobbyLive from "@/components/matches/matches-lobby-live";

interface GameRow {
  id: string;
  name: string;
  slug: string;
  min_stake: number;
  max_stake: number;
}

export default async function MatchesPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const [{ data: games }, { openMatches, liveMatches }, friends] = await Promise.all([
    supabase
      .from("games")
      .select("id, name, slug, min_stake, max_stake")
      .eq("is_active", true)
      .order("name"),
    getLobbyData(user.id),
    FriendService.getFriends(user.id),
  ]);

  const friendOptions = (friends ?? []).map((f) => {
    const friend = f.friend as unknown as { id: string; username: string } | null;
    return {
      id: friend?.id ?? f.id,
      username: friend?.username ?? "Friend",
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Matchmaking</h1>
        <p className="mt-1 text-sm text-[var(--lj-muted)]">Create an open match, challenge a friend, jump into one that's already waiting, or watch a live match in progress.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateMatchForm games={(games ?? []) as GameRow[]} />
        <ChallengeFriendForm games={(games ?? []) as GameRow[]} friends={friendOptions} />
      </div>

      <MatchesLobbyLive initialOpenMatches={openMatches} initialLiveMatches={liveMatches} />
    </div>
  );
}
