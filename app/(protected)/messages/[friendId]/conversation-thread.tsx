"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useDirectMessageRealtime, type DirectMessageRow } from "@/hooks/use-direct-message-realtime";

interface Props {
  currentUserId: string;
  friendId: string;
  friendUsername: string;
  initialMessages: DirectMessageRow[];
}

export default function ConversationThread({ currentUserId, friendId, initialMessages }: Props) {
  const [messages, setMessages] = useState<DirectMessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Live updates for this specific thread. The global toast listener
  // (dm-toast-listener.tsx) also subscribes to the same table for
  // this same user, but on its own independent channel (unique per
  // useDirectMessageRealtime instance via useId) - so having both
  // mounted at once here is safe, not a duplicate-subscription bug.
  useDirectMessageRealtime(currentUserId, (row) => {
    if (row.sender_id === friendId || row.receiver_id === friendId) {
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
    }
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage() {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError("");
    // Optimistic add so sending feels instant even before the realtime
    // echo (or the request response) comes back.
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        sender_id: currentUserId,
        receiver_id: friendId,
        message: trimmed,
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]);
    setDraft("");

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: friendId, message: trimmed }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Could not send message");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setDraft(trimmed);
      } else {
        // Replace the optimistic row with the real one (real id, real
        // timestamp) so a later realtime echo for the same insert is
        // recognized as a duplicate and skipped, not appended twice.
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? json.data : m)));
      }
    } catch {
      setError("Network error - please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setDraft(trimmed);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border" style={{ borderColor: "var(--lj-border)" }}>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-[var(--lj-muted)]">
            No messages yet - say hi!
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm"
                style={{
                  background: mine ? "var(--lj-blue-2)" : "var(--lj-card-2)",
                  color: mine ? "#fff" : "var(--lj-text)",
                  border: mine ? "none" : "1px solid var(--lj-border)",
                }}
              >
                {m.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 py-2 text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2 border-t p-3" style={{ borderColor: "var(--lj-border)" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message…"
          maxLength={1000}
          className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--lj-muted)]"
        />
        <button
          onClick={sendMessage}
          disabled={sending || !draft.trim()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-50"
          style={{ background: "var(--lj-blue-2)" }}
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
