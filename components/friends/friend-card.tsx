interface FriendCardProps {
  id: string;
  username: string;
  online?: boolean;
}

export default function FriendCard({
  username,
  online = false,
}: FriendCardProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm">
      <div>
        <h3 className="font-semibold">{username}</h3>

        <p className="text-sm text-gray-500">{online ? "Online" : "Offline"}</p>
      </div>

      <button className="rounded-lg bg-blue-600 px-4 py-2 text-white">
        Challenge
      </button>
    </div>
  );
}
