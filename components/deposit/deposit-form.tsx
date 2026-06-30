"use client";

import { useState } from "react";

export default function DepositForm() {
  const [amount, setAmount] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("Deposit:", amount);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border bg-white p-6 shadow-sm"
    >
      <h2 className="mb-4 text-xl font-semibold">Make Deposit</h2>

      <div className="space-y-4">
        <input
          type="number"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-lg border p-3"
        />

        <button
          type="submit"
          className="w-full rounded-lg bg-green-600 py-3 font-medium text-white"
        >
          Continue to Payment
        </button>
      </div>
    </form>
  );
}
