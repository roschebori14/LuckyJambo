import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { MessageService } from "@/lib/messages/message-service";

interface ConversationRow {
  friend_id: string;
  friend_username: string;
  friend_avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  last_message_sender_id: string;
  unread_count: number;
}

export default async function MessagesInboxPage() {
  const conversations = (await MessageService.getConversations()) as ConversationRow[];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="lj-page-header -mx-4 -mt-4 px-4 pb-5 pt-4 md:-mx-6 md:-mt-6 md:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <MessageCircle size={24} style={{ color: "var(--lj-cyan)" }} /> Messages
        </h1>
      </div>

      {conversations.length === 0 ? (
        <div className="lj-card p-8 text-center text-sm text-[var(--lj-muted)]">
          No conversations yet - visit a friend&apos;s profile or the{" "}
          <Link href="/friends" className="text-[var(--lj-blue-2)] hover:underline">
            Friends
          </Link>{" "}
          page to start one.
        </div>
      ) : (
        <div className="lj-card divide-y overflow-hidden" style={{ borderColor: "var(--lj-border)" }}>
          {conversations.map((c) => (
            <Link
              key={c.friend_id}
              href={`/messages/${c.friend_id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
                style={{ background: "linear-gradient(135deg,var(--lj-blue),var(--lj-cyan))" }}
              >
                {c.friend_username?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate font-semibold text-white">{c.friend_username}</p>
                  {c.last_message_at && (
                    <span className="flex-shrink-0 text-xs text-[var(--lj-muted)]">
                      {new Date(c.last_message_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-[var(--lj-muted)]">{c.last_message}</p>
              </div>
              {c.unread_count > 0 && (
                <span
                  className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white"
                  style={{ background: "var(--lj-blue-2)" }}
                >
                  {c.unread_count}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
