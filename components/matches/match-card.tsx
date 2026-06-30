interface MatchCardProps {
  id: string;
  gameName: string;
  stakeAmount: number;
  status: string;
  creatorName: string;
}

export default function MatchCard({
  id,
  gameName,
  stakeAmount,
  status,
  creatorName,
}: MatchCardProps) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{gameName}</h3>

        <span className="rounded-full bg-blue-100 px-3 py-1 text-sm">
          {status}
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-500">Created by {creatorName}</p>

      <p className="mt-3 font-medium">Stake: {stakeAmount} XAF</p>

      <button className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-white">
        Join Match
      </button>
    </div>
  );
}
