"use client";

import { useState } from "react";

export default function CreateMatchForm() {
  const [gameSlug, setGameSlug] = useState("chess");
  const [stakeAmount, setStakeAmount] = useState("");

  async function createMatch(e: React.FormEvent) {
    e.preventDefault();

    await fetch("/api/matches/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        game_slug: gameSlug,
        stake_amount: Number(stakeAmount),
      }),
    });
  }

  return (
    <form onSubmit={createMatch} className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold">Create Match</h2>

      <select
        value={gameSlug}
        onChange={(e) => setGameSlug(e.target.value)}
        className="mb-3 w-full rounded-lg border p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="chess">Chess</option>
        <option value="draughts">Draughts</option>
        <option value="tic-tac-toe">Tic Tac Toe</option>
        <option value="dice">Dice</option>
        <option value="rock-paper-scissors">Rock Paper Scissors</option>
        <option value="coin-flip">Coin Flip</option>
      </select>

      <input
        type="number"
        value={stakeAmount}
        onChange={(e) => setStakeAmount(e.target.value)}
        placeholder="Stake Amount (XAF)"
        className="mb-4 w-full rounded-lg border p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <button className="rounded-lg bg-blue-600 px-4 py-3 text-white">
        Create Match
      </button>
    </form>
  );
}
