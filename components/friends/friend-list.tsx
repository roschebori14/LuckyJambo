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
      <div className="lj-card p-6 text-center text-sm text-[var(--lj-muted)]">
        No friends yet — search a username above or share your invite link.
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
