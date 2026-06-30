import MatchCard from "./match-card";

interface Match {
  id: string;
  gameName: string;
  creatorName: string;
  stakeAmount: number;
  status: string;
}

interface MatchListProps {
  matches: Match[];
}

export default function MatchList({ matches }: MatchListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {matches.map((match) => (
        <MatchCard
          key={match.id}
          id={match.id}
          gameName={match.gameName}
          creatorName={match.creatorName}
          stakeAmount={match.stakeAmount}
          status={match.status}
        />
      ))}
    </div>
  );
}
