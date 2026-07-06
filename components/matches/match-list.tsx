import { Swords } from "lucide-react";
import MatchCard from "./match-card";
import type { LobbyMatch } from "@/lib/matchmaking/lobby-service";

interface MatchListProps {
  matches: LobbyMatch[];
  emptyMessage?: string;
  /** Match ids that just streamed in via realtime this session - see
   *  MatchesLobbyLive. Drives the one-time gold arrival glow + "Just
   *  now" pill on a card, so a lobby that updates live actually *looks*
   *  live instead of new rows silently appearing in the grid. */
  justArrivedIds?: Set<string>;
}

export default function MatchList({ matches, emptyMessage, justArrivedIds }: MatchListProps) {
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--lj-border)] bg-white/[0.02] px-8 py-12 text-center">
        <Swords size={22} className="text-[var(--lj-muted)]" />
        <p className="text-sm text-[var(--lj-muted)]">
          {emptyMessage ?? "No open matches right now — create one above to get the ball rolling."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {matches.map((match, i) => (
        <div key={match.id} className="lj-fade-in-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
          <MatchCard
            id={match.id}
            gameName={match.gameName}
            gameSlug={match.gameSlug}
            creatorName={match.creatorName}
            stakeAmount={match.stakeAmount}
            status={match.status}
            timestamp={match.timestamp}
            isOwn={match.isOwn}
            isParticipant={match.isParticipant}
            isNew={justArrivedIds?.has(match.id) ?? false}
          />
        </div>
      ))}
    </div>
  );
}
