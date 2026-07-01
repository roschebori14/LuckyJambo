import MatchCard from "./match-card";

interface Match {
  id: string;
  gameName: string;
  gameSlug: string;
  creatorName: string;
  stakeAmount: number;
  status: string;
  isOwn?: boolean;
}

interface MatchListProps {
  matches: Match[];
}

export default function MatchList({ matches }: MatchListProps) {
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400 shadow-sm">
        No open matches right now — create one above to get the ball rolling.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {matches.map((match) => (
        <MatchCard
          key={match.id}
          id={match.id}
          gameName={match.gameName}
          gameSlug={match.gameSlug}
          creatorName={match.creatorName}
          stakeAmount={match.stakeAmount}
          status={match.status}
          isOwn={match.isOwn}
        />
      ))}
    </div>
  );
}
