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
        <p className="text-lg font-semibold text-gray-700">Match not found</p>
        <Link href="/games" className="text-sm text-green-600 hover:underline">Back to Games</Link>
      </div>
    );
  }

  const gameName = (match.games as { name: string } | null)?.name ?? slug;
  const gameSlug = (match.games as { slug: string } | null)?.slug ?? slug;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/games/${slug}`} className="text-sm text-gray-500 hover:text-gray-800">
          ← {gameName}
        </Link>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          match.status === "active"    ? "bg-green-100 text-green-700" :
          match.status === "waiting"   ? "bg-yellow-100 text-yellow-700" :
          match.status === "completed" ? "bg-gray-100 text-gray-600" :
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
      />
    </div>
  );
}
