import Link from "next/link";
import { Swords, MessageCircle } from "lucide-react";

interface FriendCardProps {
  id: string;
  username: string;
  online?: boolean;
}

export default function FriendCard({
  id,
  username,
  online = false,
}: FriendCardProps) {
  return (
    <div className="lj-card flex items-center justify-between p-4">
      <Link href={`/profile/${username}`} className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--lj-blue) 0%, var(--lj-cyan) 100%)" }}
        >
          {username.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h3 className="font-semibold text-white hover:underline">{username}</h3>
          <p className="flex items-center gap-1.5 text-xs text-[var(--lj-muted)]">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: online ? "var(--lj-success)" : "var(--lj-muted)" }}
            />
            {online ? "Online" : "Offline"}
          </p>
        </div>
      </Link>

      <div className="flex items-center gap-2">
        <Link
          href={`/messages/${id}`}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-[var(--lj-muted)] transition-colors hover:bg-white/5 hover:text-white"
          style={{ border: "1px solid var(--lj-border)" }}
        >
          <MessageCircle size={13} /> Message
        </Link>
        <Link
          href="/matches"
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition-colors hover:brightness-110"
          style={{ background: "var(--lj-blue)" }}
        >
          <Swords size={13} /> Challenge
        </Link>
      </div>
    </div>
  );
}
