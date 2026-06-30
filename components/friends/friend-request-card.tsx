interface FriendRequestCardProps {
  requestId: string;
  username: string;

  onAccept: (requestId: string) => void;

  onReject: (requestId: string) => void;
}

export default function FriendRequestCard({
  requestId,
  username,
  onAccept,
  onReject,
}: FriendRequestCardProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-white p-4">
      <span>{username}</span>

      <div className="flex gap-2">
        <button
          onClick={() => onAccept(requestId)}
          className="rounded-lg bg-green-600 px-3 py-2 text-white"
        >
          Accept
        </button>

        <button
          onClick={() => onReject(requestId)}
          className="rounded-lg bg-red-600 px-3 py-2 text-white"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
