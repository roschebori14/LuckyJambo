"use client";

import FriendCard from "./friend-card";
import { useOnlineUsers } from "@/lib/presence/presence-context";

interface Friend {
  id: string;
  username: string;
}

interface FriendListProps {
  friends: Friend[];
}

export default function FriendList({ friends }: FriendListProps) {
  const onlineIds = useOnlineUsers();

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
          online={onlineIds.has(friend.id)}
        />
      ))}
    </div>
  );
}
