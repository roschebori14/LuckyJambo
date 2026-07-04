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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: match } = await supabase
    .from("matches")
    .select("*, games(name, slug)")
    .eq("id", matchId)
    .single();

  if (!match) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-lg font-semibold text-[var(--lj-text)]">Match not found</p>
        <Link href="/games" className="text-sm text-green-600 hover:underline">Back to Games</Link>
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

  // Opponent info for the post-match "Rematch" action - a rematch
  // challenges the same opponent again rather than opening a new
  // match to anyone. Only needed once there IS an opponent (both
  // participants present), so this is best-effort: an open "waiting"
  // match with nobody else in it yet simply won't offer a rematch
  // target (there's nothing to render there anyway since that state
  // shows the "waiting for opponent" screen, not the completed one).
  const { data: participantRows } = await supabase
    .from("match_participants")
    .select("user_id")
    .eq("match_id", matchId);

  const opponentId = participantRows?.map((p) => p.user_id).find((id) => id !== user.id) ?? null;

  let opponentUsername: string | null = null;
  if (opponentId) {
    const { data: opponentProfiles } = await supabase.rpc("get_public_profiles_by_ids", {
      p_ids: [opponentId],
    });
    opponentUsername = opponentProfiles?.[0]?.username ?? null;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/games/${slug}`} className="text-sm text-[var(--lj-muted)] hover:text-white">
          ← {gameName}
        </Link>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          match.status === "active"    ? "bg-green-100 text-green-300" :
          match.status === "waiting"   ? "bg-yellow-100 text-yellow-300" :
          match.status === "completed" ? "bg-white/5 text-[var(--lj-muted)]" :
          "bg-red-100 text-red-600"
        }`}>
          {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
        </span>
      </div>

      <GameClient
        matchId={matchId}
        gameSlug={gameSlug}
        userId={user.id}
        stakeAmount={match.stake_amount ?? 0}
        initialStatus={match.status}
        isParticipant={isParticipant}
        initialWinnerId={match.winner_id ?? null}
        opponentId={opponentId}
        opponentUsername={opponentUsername}
      />
    </div>
  );
}
