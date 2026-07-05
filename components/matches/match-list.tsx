import MatchCard from "./match-card";

interface Match {
  id: string;
  gameName: string;
  gameSlug: string;
  creatorName: string;
  stakeAmount: number;
  status: string;
  isOwn?: boolean;
  isParticipant?: boolean;
}

interface MatchListProps {
  matches: Match[];
  emptyMessage?: string;
}

export default function MatchList({ matches, emptyMessage }: MatchListProps) {
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-8 text-center text-sm text-[var(--lj-muted)] shadow-sm">
        {emptyMessage ?? "No open matches right now — create one above to get the ball rolling."}
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
          isParticipant={match.isParticipant}
        />
      ))}
    </div>
  );
}
