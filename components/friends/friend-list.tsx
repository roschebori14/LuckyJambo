import FriendCard from "./friend-card";

interface Friend {
  id: string;
  username: string;
  online?: boolean;
}

interface FriendListProps {
  friends: Friend[];
}

export default function FriendList({ friends }: FriendListProps) {
  if (!friends.length) {
    return (
      <div className="rounded-xl border bg-white p-6 text-center">
        No friends found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {friends.map((friend) => (
        <FriendCard
          key={friend.id}
          id={friend.id}
          username={friend.username}
          online={friend.online}
        />
      ))}
    </div>
  );
}
