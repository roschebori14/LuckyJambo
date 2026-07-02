import { Users } from "lucide-react";
import { requireAuth } from "@/lib/auth/require-auth";
import { FriendService } from "@/lib/friends/friend-service";
import InviteLinkCard from "@/components/friends/invite-link-card";
import AddFriendForm from "@/components/friends/add-friend-form";
import FriendRequestsPanel from "@/components/friends/friend-requests-panel";
import FriendList from "@/components/friends/friend-list";

export default async function FriendsPage() {
  const user = await requireAuth();

  const [friendRows, requestRows] = await Promise.all([
    FriendService.getFriends(user.id),
    FriendService.getRequests(user.id),
  ]);

  // Supabase's typed join comes back as a nested object per row; flatten
  // it here so the presentational components can stay simple.
  const friends = (friendRows ?? []).map((row) => {
    const friend = row.friend as unknown as { id: string; username: string } | null;
    return {
      id: friend?.id ?? row.id,
      username: friend?.username ?? "Unknown",
    };
  });

  const requests = (requestRows ?? []) as unknown as {
    id: string;
    created_at: string;
    sender: { id: string; username: string; avatar_url: string | null; is_verified: boolean };
  }[];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="lj-page-header -mx-4 -mt-4 px-4 pb-5 pt-4 md:-mx-6 md:-mt-6 md:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <Users size={22} style={{ color: "var(--lj-cyan)" }} /> Friends
        </h1>
      </div>

      <InviteLinkCard />

      <AddFriendForm />

      <FriendRequestsPanel requests={requests} />

      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--lj-muted)]">
          Your Friends ({friends.length})
        </h2>
        <FriendList friends={friends} />
      </div>
    </div>
  );
}
