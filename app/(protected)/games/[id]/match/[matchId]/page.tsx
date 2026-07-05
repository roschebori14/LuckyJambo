import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import GameClient from "./game-client";

interface PageProps {
  params: Promise<{ id: string; matchId: string }>;
}

export default async function MatchPlayPage({ params }: PageProps) {
  const { id: slug, matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: match } = await supabase
    .from("matches")
    .select("*, games(name, slug)")
    .eq("id", matchId)
    .single();

  if (!match) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-lg font-semibold text-[var(--lj-text)]">
          Match not found
        </p>
        <Link href="/games" className="text-sm text-green-600 hover:underline">
          Back to Games
        </Link>
      </div>
    );
  }

  const gameName = (match.games as { name: string } | null)?.name ?? slug;
  const gameSlug = (match.games as { slug: string } | null)?.slug ?? slug;

  // A friend opening a direct challenge link (or anyone opening an
  // open-match link without going through the "Join Match" button on
  // the lobby list) has never actually called /api/matches/join - so
  // they have no match_participants row yet and the match itself is
  // still stuck on status "waiting" forever. Without this check the
  // page just showed the "waiting for opponent" spinner to that
  // person too, and the creator's board never activated because
  // nobody had actually joined. Detect that case here and let
  // GameClient render a "Join Match" action instead.
  const { data: participant } = await supabase
    .from("match_participants")
    .select("user_id")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .maybeSingle();

  const isParticipant = !!participant;

  // Every participant in the match (0-2 rows). Reading someone else's
  // participant row here only works now that match_participants RLS
  // (migration 049) allows it for matches you can already view - it
  // used to be locked to "your own row only", which silently broke
  // opponent-name lookups for real players too, not just spectators.
  const { data: participantRows } = await supabase
    .from("match_participants")
    .select("user_id")
    .eq("match_id", matchId);

  const participantIds = participantRows?.map((p) => p.user_id) ?? [];

  type PublicProfile = { id: string; username: string };

  const { data: participantProfiles } = participantIds.length
    ? await supabase.rpc("get_public_profiles_by_ids", {
        p_ids: participantIds,
      })
    : { data: [] as PublicProfile[] };

  const usernameById = new Map(
    ((participantProfiles ?? []) as PublicProfile[]).map((p) => [
      p.id,
      p.username,
    ]),
  );

  // Opponent info (relative to the current user) for the post-match
  // "Rematch" action - only meaningful when the viewer is one of the
  // two players.
  const opponentId = participantIds.find((id) => id !== user.id) ?? null;
  const opponentUsername = opponentId
    ? (usernameById.get(opponentId) ?? null)
    : null;

  // A non-participant only ever gets a genuine "spectate" view once
  // the match has actually started or finished - an 'active'/
  // 'completed' match already has its two players locked in, so there's
  // nothing for a third visitor to join. A 'waiting' match, by
  // contrast, still has an open (or specifically-invited) seat, so
  // that case keeps going through GameClient's existing "Accept
  // Challenge" / join flow instead of spectate mode.
  const isSpectator = !isParticipant && match.status !== "waiting";

  // "PlayerA vs PlayerB" label for the spectator view, independent of
  // which user is viewing.
  const players = participantIds.map((id) => usernameById.get(id) ?? "Player");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/games/${slug}`}
          className="text-sm text-[var(--lj-muted)] hover:text-white"
        >
          ← {gameName}
        </Link>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            match.status === "active"
              ? "bg-green-100 text-green-300"
              : match.status === "waiting"
                ? "bg-yellow-100 text-yellow-300"
                : match.status === "completed"
                  ? "bg-white/5 text-[var(--lj-muted)]"
                  : "bg-red-100 text-red-600"
          }`}
        >
          {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
        </span>
      </div>

      {isSpectator && (
        <div
          className="rounded-xl px-4 py-2.5 text-center text-xs font-semibold text-[var(--lj-muted)]"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--lj-border)",
          }}
        >
          👀 Spectating
          {players.length === 2 ? ` — ${players[0]} vs ${players[1]}` : ""}
        </div>
      )}

      <GameClient
        matchId={matchId}
        gameSlug={gameSlug}
        userId={user.id}
        stakeAmount={match.stake_amount ?? 0}
        initialStatus={match.status}
        isParticipant={isParticipant}
        isSpectator={isSpectator}
        initialWinnerId={match.winner_id ?? null}
        opponentId={opponentId}
        opponentUsername={opponentUsername}
      />
    </div>
  );
}
