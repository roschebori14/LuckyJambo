import { Check, X } from "lucide-react";

interface FriendRequestCardProps {
  requestId: string;
  username: string;
  busy?: boolean;

  onAccept: (requestId: string) => void;

  onReject: (requestId: string) => void;
}

export default function FriendRequestCard({
  requestId,
  username,
  busy = false,
  onAccept,
  onReject,
}: FriendRequestCardProps) {
  return (
    <div className="lj-card flex items-center justify-between p-4">
      <div className="flex items-center gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: "var(--lj-blue)" }}
        >
          {username.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-white">{username}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAccept(requestId)}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          style={{ background: "var(--lj-success)" }}
        >
          <Check size={13} /> Accept
        </button>

        <button
          onClick={() => onReject(requestId)}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          style={{ background: "var(--lj-danger)" }}
        >
          <X size={13} /> Reject
        </button>
      </div>
    </div>
  );
}
