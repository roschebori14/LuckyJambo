"use client";

import { useState } from "react";
import { RefreshCcw, XCircle } from "lucide-react";

export default function ReportActions({ reportId }: { reportId: string }) {
  const [loading, setLoading] = useState<"refund" | "dismiss" | null>(null);
  const [done, setDone] = useState(false);

  async function act(action: "refund" | "dismiss") {
    setLoading(action);
    try {
      const res = await fetch("/api/admin/reports/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId, action }),
      });
      const json = await res.json();
      if (json.success) setDone(true);
    } finally {
      setLoading(null);
    }
  }

  if (done) return <span className="lj-badge bg-green-500/20 text-green-400">Resolved</span>;

  return (
    <div className="flex flex-shrink-0 gap-2">
      <button onClick={() => act("refund")} disabled={!!loading}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
        style={{ background: "var(--lj-success)" }}>
        <RefreshCcw size={12} /> Refund Both
      </button>
      <button onClick={() => act("dismiss")} disabled={!!loading}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
        style={{ background: "var(--lj-muted)" }}>
        <XCircle size={12} /> Dismiss
      </button>
    </div>
  );
}
