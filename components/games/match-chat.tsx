"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import {
  useMatchChatRealtime,
  type MatchChatRow,
} from "@/hooks/use-match-chat-realtime";
import {
  MATCH_CHAT_PHRASES,
  MATCH_CHAT_EMOJI,
} from "@/lib/games/match-chat-presets";

interface Props {
  matchId: string;
  userId: string;
  opponentUsername?: string | null;
}

// Client-side mirror of the server's 2s-per-user cooldown
// (047_match_chat.sql) - purely a UX nicety so tapping a preset twice
// fast just does nothing instead of round-tripping into a 429. The
// actual enforcement lives in the DB trigger regardless of this.
const COOLDOWN_MS = 2000;

export default function MatchChat({ matchId, userId, opponentUsername }: Props) {
  const [messages, setMessages] = useState<MatchChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cooldownActive, setCooldownActive] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const appendMessage = useCallback((row: MatchChatRow) => {
    if (seenIds.current.has(row.id)) return;
    seenIds.current.add(row.id);
    setMessages((prev) => [...prev, row]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/history?match_id=${matchId}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          const rows = json.messages as MatchChatRow[];
          rows.forEach((r) => seenIds.current.add(r.id));
          setMessages(rows);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useMatchChatRealtime(matchId, appendMessage);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function sendMessage(message: string) {
    if (cooldownActive) return;
    setError("");
    setCooldownActive(true);
    setTimeout(() => setCooldownActive(false), COOLDOWN_MS);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, message }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Couldn't send that.");
        return;
      }
      appendMessage(json.chat_message as MatchChatRow);
    } catch {
      setError("Network error — please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--lj-muted)]">
        <MessageCircle size={16} />
        Quick chat
      </div>

      <div
        ref={listRef}
        className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-xl bg-black/10 px-3 py-2"
      >
        {loading && (
          <p className="py-2 text-center text-xs text-[var(--lj-muted)]">Loading chat…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="py-2 text-center text-xs text-[var(--lj-muted)]">
            No messages yet — say hi 👋
          </p>
        )}
        {messages.map((m) => {
          const isMe = m.user_id === userId;
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm ${
                  isMe
                    ? "bg-blue-600 text-white"
                    : "bg-[var(--lj-card)] text-white"
                }`}
              >
                {!isMe && opponentUsername && (
                  <span className="mr-1.5 text-[10px] font-semibold uppercase opacity-60">
                    {opponentUsername}
                  </span>
                )}
                {m.message}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-1.5">
        {MATCH_CHAT_EMOJI.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendMessage(emoji)}
            disabled={cooldownActive}
            className="rounded-lg bg-white/5 px-2.5 py-1.5 text-base hover:bg-white/10 disabled:opacity-40"
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {MATCH_CHAT_PHRASES.map((phrase) => (
          <button
            key={phrase}
            onClick={() => sendMessage(phrase)}
            disabled={cooldownActive}
            className="rounded-full border border-[var(--lj-border)] px-3 py-1 text-xs font-medium text-[var(--lj-muted)] hover:bg-white/5 hover:text-white disabled:opacity-40"
          >
            {phrase}
          </button>
        ))}
      </div>
    </div>
  );
}
