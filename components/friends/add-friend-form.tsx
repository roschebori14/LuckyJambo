"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, UserPlus, Check, AlertCircle } from "lucide-react";

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
  is_verified: boolean;
}

export default function AddFriendForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  // Debounced search-as-you-type, same pattern as the rest of the app
  // uses for anything that hits the network on input change.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/friends/search?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        if (json.success) setResults(json.results);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [query]);

  async function sendRequest(receiverId: string) {
    setError("");
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: receiverId }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Could not send request");
        return;
      }
      setSentIds((prev) => new Set(prev).add(receiverId));
    } catch {
      setError("Network error — please try again.");
    }
  }

  return (
    <div className="lj-card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold text-white">
        <UserPlus size={16} style={{ color: "var(--lj-cyan)" }} /> Add Friend
      </h2>

      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--lj-muted)]" />
        <input
          type="text"
          placeholder="Search by username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="lj-input !pl-11"
        />
      </div>

      {error && (
        <div
          className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
          style={{ background: "rgba(255, 61, 90, 0.1)", color: "var(--lj-danger)" }}
        >
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {searching && (
        <p className="mt-3 text-xs text-[var(--lj-muted)]">Searching…</p>
      )}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-3 text-xs text-[var(--lj-muted)]">No users found for &quot;{query}&quot;</p>
      )}

      {results.length > 0 && (
        <div className="mt-3 space-y-2">
          {results.map((r) => {
            const sent = sentIds.has(r.id);
            return (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <Link href={`/profile/${r.username}`} className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: "var(--lj-blue)" }}
                  >
                    {r.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-white hover:underline">{r.username}</span>
                </Link>
                <button
                  onClick={() => sendRequest(r.id)}
                  disabled={sent}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-colors disabled:opacity-60"
                  style={{ background: sent ? "var(--lj-success)" : "var(--lj-blue)" }}
                >
                  {sent ? <Check size={13} /> : <UserPlus size={13} />}
                  {sent ? "Sent" : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
