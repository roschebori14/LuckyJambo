import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { FriendService } from "@/lib/friends/friend-service";
import CreateMatchForm from "@/components/matches/create-match-form";
import ChallengeFriendForm from "@/components/matches/challenge-friend-form";
import MatchList from "@/components/matches/match-list";

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

  const [{ data: games }, { data: matches }, friends] = await Promise.all([
    supabase
      .from("games")
      .select("id, name, slug, min_stake, max_stake")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("matches")
      .select("id, stake_amount, status, created_at, creator_id, games(name, slug)")
      .eq("status", "waiting")
      .order("created_at", { ascending: false })
      .limit(30),
    FriendService.getFriends(user.id),
  ]);

  // Resolve creator + friend usernames in one batch. matches.creator_id
  // isn't embeddable via a single `profiles(username)` select because
  // matches has two FKs into profiles (creator_id and winner_id), which
  // PostgREST can't disambiguate without knowing the exact constraint
  // name - simpler and more robust to just fetch profiles separately.
  const friendIds = (friends ?? []).map((f) => f.friend_id);
  const creatorIds = (matches ?? []).map((m) => m.creator_id).filter(Boolean);
  const profileIds = Array.from(new Set([...friendIds, ...creatorIds]));

  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, username").in("id", profileIds)
    : { data: [] as { id: string; username: string }[] };

  const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  const openMatches = (matches ?? []).map((m) => ({
    id: m.id,
    gameName: (m.games as unknown as { name: string } | null)?.name ?? "Game",
    gameSlug: (m.games as unknown as { slug: string } | null)?.slug ?? "",
    creatorName: usernameById.get(m.creator_id) ?? "Player",
    stakeAmount: m.stake_amount,
    status: m.status,
    isOwn: m.creator_id === user.id,
  }));

  const friendOptions = (friends ?? []).map((f) => ({
    id: f.friend_id,
    username: usernameById.get(f.friend_id) ?? "Friend",
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Matchmaking</h1>
        <p className="mt-1 text-sm text-gray-500">Create an open match, challenge a friend, or jump into one that's already waiting.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateMatchForm games={(games ?? []) as GameRow[]} />
        <ChallengeFriendForm games={(games ?? []) as GameRow[]} friends={friendOptions} />
      </div>

      <div>
        <h2 className="mb-3 text-xl font-bold text-gray-900">
          Open Matches <span className="ml-1 text-sm font-normal text-gray-400">({openMatches.length})</span>
        </h2>
        <MatchList matches={openMatches} />
      </div>
    </div>
  );
}
