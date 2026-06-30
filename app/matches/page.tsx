import CreateMatchForm from "@/components/matches/create-match-form";
import ChallengeFriendForm from "@/components/matches/challenge-friend-form";
import MatchList from "@/components/matches/match-list";

export default function MatchesPage() {
  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Matchmaking</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateMatchForm />
        <ChallengeFriendForm />
      </div>

      <MatchList matches={[]} />
    </div>
  );
}
