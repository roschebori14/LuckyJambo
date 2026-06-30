import GameCard from "./game-card";

interface Game {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  min_stake: number;
  max_stake: number;
}

export default function GameList({ games }: { games: Game[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}
