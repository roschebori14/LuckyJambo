"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

interface Props {
  withdrawalId: string;
  userId: string;
  amount: number;
}

export default function WithdrawalActions({ withdrawalId, userId, amount }: Props) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  async function act(action: "approve" | "reject") {
    setLoading(action);
    try {
      const res = await fetch("/api/admin/withdrawals/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawal_id: withdrawalId, user_id: userId, amount, action }),
      });
      const json = await res.json();
      if (json.success) setDone(action === "approve" ? "approved" : "rejected");
    } finally {
      setLoading(null);
    }
  }

  if (done) return (
    <span className={`lj-badge ${done === "approved" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
      {done}
    </span>
  );

  return (
    <div className="flex gap-2">
      <button onClick={() => act("approve")} disabled={!!loading}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
        style={{ background: "var(--lj-success)" }}>
        {loading === "approve" ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check size={12} />}
        Approve
      </button>
      <button onClick={() => act("reject")} disabled={!!loading}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
        style={{ background: "var(--lj-danger)" }}>
        {loading === "reject" ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <X size={12} />}
        Reject
      </button>
    </div>
  );
}
