"use client";
import { useState } from "react";
import { Flag, Clock, AlertTriangle } from "lucide-react";

export default function MatchActions({ matchId }: { matchId: string }) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<"forfeit"|"report"|null>(null);
  const [msg, setMsg] = useState("");

  async function claimForfeit() {
    setLoading("forfeit"); setMsg("");
    const res = await fetch("/api/matches/claim-forfeit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ match_id: matchId }) });
    const j = await res.json();
    setMsg(j.success ? "✅ Forfeit win claimed!" : "❌ " + j.message);
    setLoading(null);
  }

  async function submitReport() {
    if (reason.length < 10) { setMsg("❌ Please describe the issue in more detail."); return; }
    setLoading("report"); setMsg("");
    const res = await fetch("/api/matches/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ match_id: matchId, reason }) });
    const j = await res.json();
    setMsg(j.success ? "✅ Report submitted. An admin will review it." : "❌ " + j.message);
    if (j.success) { setReporting(false); setReason(""); }
    setLoading(null);
  }

  return (
    <div className="space-y-2">
      {msg && <p className={`text-xs ${msg.startsWith("✅") ? "text-[var(--lj-success)]" : "text-red-400"}`}>{msg}</p>}

      <div className="flex gap-2 flex-wrap">
        <button onClick={claimForfeit} disabled={loading === "forfeit"}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" }}>
          {loading === "forfeit" ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"/> : <Clock size={12}/>}
          Claim Forfeit
        </button>
        <button onClick={() => setReporting(v => !v)}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:brightness-110"
          style={{ background: "rgba(255,61,90,0.1)", border: "1px solid rgba(255,61,90,0.2)", color: "var(--lj-danger)" }}>
          <Flag size={12}/> Report Issue
        </button>
      </div>

      {reporting && (
        <div className="space-y-2 rounded-xl p-3" style={{ background: "rgba(255,61,90,0.05)", border: "1px solid rgba(255,61,90,0.2)" }}>
          <div className="flex items-center gap-1.5 text-xs text-red-400"><AlertTriangle size={12}/> Describe the issue</div>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
            placeholder="E.g. opponent disappeared, game got stuck, suspected cheating…"
            className="lj-input text-xs" />
          <button onClick={submitReport} disabled={loading === "report"}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            style={{ background: "var(--lj-danger)" }}>
            {loading === "report" ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"/> : <Flag size={12}/>}
            Submit Report
          </button>
        </div>
      )}
    </div>
  );
}
