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

  const [{ data: games }, { data: matches }, { data: activeMatches }, friends] = await Promise.all([
    supabase
      .from("games")
      .select("id, name, slug, min_stake, max_stake")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("matches")
      .select("id, stake_amount, status, created_at, creator_id, invited_user_id, games(name, slug)")
      .eq("status", "waiting")
      // matches RLS ("view own or spectatable matches", migration 049)
      // allows reading every waiting/active/completed row, so without
      // this filter a private friend challenge (invited_user_id set)
      // would still show up in everyone's open matches list even
      // though join_match blocks anyone but the invited friend from
      // actually joining it - confusing and defeats the point of a
      // private challenge. Only show truly open matches, plus any
      // private challenge addressed to the current user.
      .or(`invited_user_id.is.null,invited_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(30),
    // Active matches are now visible platform-wide too (migration 049)
    // so people can find a live match to spectate, not just their own -
    // this is the whole list, not filtered to the current user.
    supabase
      .from("matches")
      .select("id, stake_amount, status, created_at, creator_id, games(name, slug)")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(30),
    FriendService.getFriends(user.id),
  ]);

  // Resolve creator usernames in one batch, across both lists. matches.
  // creator_id isn't embeddable via a single `profiles(username)`
  // select because matches has two FKs into profiles (creator_id and
  // winner_id), which PostgREST can't disambiguate without knowing the
  // exact constraint name - simpler and more robust to just fetch
  // profiles separately. A direct `profiles` query here would also hit
  // the same RLS wall as everywhere else (it only allows a user to see
  // their own row), so this goes through the get_public_profiles_by_ids
  // RPC (migration 034) instead. getFriends() already resolves each
  // friend's profile the same way, so no separate lookup is needed for
  // those.
  const creatorIds = [...(matches ?? []), ...(activeMatches ?? [])].map((m) => m.creator_id).filter(Boolean);
  const profileIds = Array.from(new Set(creatorIds));

  const usernameById = await FriendService.getProfilesById(profileIds);

  // Which of the active matches is the current user actually playing
  // in (as opposed to a stranger's match they could only spectate)?
  // One batched query rather than checking per-row.
  const activeMatchIds = (activeMatches ?? []).map((m) => m.id);
  const { data: myParticipantRows } = activeMatchIds.length
    ? await supabase
        .from("match_participants")
        .select("match_id")
        .eq("user_id", user.id)
        .in("match_id", activeMatchIds)
    : { data: [] as { match_id: string }[] };
  const myActiveMatchIds = new Set((myParticipantRows ?? []).map((r) => r.match_id));

  const openMatches = (matches ?? []).map((m) => ({
    id: m.id,
    gameName: (m.games as unknown as { name: string } | null)?.name ?? "Game",
    gameSlug: (m.games as unknown as { slug: string } | null)?.slug ?? "",
    creatorName: usernameById.get(m.creator_id)?.username ?? "Player",
    stakeAmount: m.stake_amount,
    status: m.status,
    isOwn: m.creator_id === user.id,
  }));

  const liveMatches = (activeMatches ?? []).map((m) => ({
    id: m.id,
    gameName: (m.games as unknown as { name: string } | null)?.name ?? "Game",
    gameSlug: (m.games as unknown as { slug: string } | null)?.slug ?? "",
    creatorName: usernameById.get(m.creator_id)?.username ?? "Player",
    stakeAmount: m.stake_amount,
    status: m.status,
    isOwn: m.creator_id === user.id,
    isParticipant: myActiveMatchIds.has(m.id),
  }));

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

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-white">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>
          Active Matches <span className="ml-1 text-sm font-normal text-[var(--lj-muted)]">({liveMatches.length})</span>
        </h2>
        <p className="mb-3 text-xs text-[var(--lj-muted)]">
          Yours are marked <strong className="text-white">Resume</strong> — jump back in from anywhere,
          even if you closed the tab. Everyone else's are open to <strong className="text-white">Spectate</strong>.
        </p>
        <MatchList matches={liveMatches} emptyMessage="No matches in progress right now." />
      </div>

      <div>
        <h2 className="mb-3 text-xl font-bold text-white">
          Open Matches <span className="ml-1 text-sm font-normal text-[var(--lj-muted)]">({openMatches.length})</span>
        </h2>
        <MatchList matches={openMatches} />
      </div>
    </div>
  );
}
