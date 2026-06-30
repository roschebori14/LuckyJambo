"use client";

import { useState } from "react";

export default function ChallengeFriendForm() {
  const [friendId, setFriendId] = useState("");

  const [gameId, setGameId] = useState("");

  const [stakeAmount, setStakeAmount] = useState("");

  async function challengeFriend(e: React.FormEvent) {
    e.preventDefault();

    await fetch("/api/matches/create", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        friend_id: friendId,
        game_id: gameId,
        stake_amount: Number(stakeAmount),
      }),
    });
  }

  return (
    <form onSubmit={challengeFriend} className="rounded-xl border bg-white p-6">
      <h2 className="mb-4 text-xl font-bold">Challenge Friend</h2>

      <input
        value={friendId}
        onChange={(e) => setFriendId(e.target.value)}
        placeholder="Friend ID"
        className="mb-3 w-full rounded-lg border p-3"
      />

      <input
        value={gameId}
        onChange={(e) => setGameId(e.target.value)}
        placeholder="Game ID"
        className="mb-3 w-full rounded-lg border p-3"
      />

      <input
        type="number"
        value={stakeAmount}
        onChange={(e) => setStakeAmount(e.target.value)}
        placeholder="Stake Amount"
        className="mb-4 w-full rounded-lg border p-3"
      />

      <button className="rounded-lg bg-purple-600 px-4 py-3 text-white">
        Challenge
      </button>
    </form>
  );
}
