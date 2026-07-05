import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MessageService } from "@/lib/messages/message-service";
import ConversationThread from "./conversation-thread";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ friendId: string }>;
}) {
  const { friendId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: friendProfiles } = await supabase.rpc("get_public_profiles_by_ids", {
    p_ids: [friendId],
  });
  const friend = friendProfiles?.[0];

  if (!friend) notFound();

  const history = await MessageService.getConversation(friendId);
  await MessageService.markRead(friendId);

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col md:h-[calc(100vh-4rem)]">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/messages" className="rounded-lg p-2 text-[var(--lj-muted)] hover:bg-white/5 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-black text-white"
          style={{ background: "linear-gradient(135deg,var(--lj-blue),var(--lj-cyan))" }}
        >
          {friend.username?.[0]?.toUpperCase() ?? "?"}
        </div>
        <h1 className="text-lg font-bold text-white">{friend.username}</h1>
      </div>

      <ConversationThread
        currentUserId={user.id}
        friendId={friendId}
        friendUsername={friend.username}
        initialMessages={history}
      />
    </div>
  );
}
