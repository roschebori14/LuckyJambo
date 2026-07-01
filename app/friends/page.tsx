import FriendList from "@/components/friends/friend-list";
import SendFriendRequestForm from "@/components/friends/send-friend-request-form";

export default function FriendsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Friends</h1>

      <SendFriendRequestForm />

      <FriendList friends={[]} />
    </div>
  );
}
