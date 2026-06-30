"use client";

import { useState } from "react";

export default function SendFriendRequestForm() {
  const [receiverId, setReceiverId] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      await fetch("/api/friends/request", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          receiver_id: receiverId,
        }),
      });

      setReceiverId("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border bg-white p-6 shadow-sm"
    >
      <h2 className="mb-4 text-xl font-semibold">Add Friend</h2>

      <input
        type="text"
        value={receiverId}
        onChange={(e) => setReceiverId(e.target.value)}
        placeholder="User ID"
        className="mb-4 w-full rounded-lg border p-3"
      />

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-3 text-white"
      >
        {loading ? "Sending..." : "Send Request"}
      </button>
    </form>
  );
}
