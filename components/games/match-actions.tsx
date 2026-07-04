"use client";
import { useState } from "react";
import { Flag, Clock, AlertTriangle, FlagOff, Coins } from "lucide-react";

export default function MatchActions({ matchId, onMatchEnded, hideResign = false, stakeAmount }: { matchId: string; onMatchEnded?: () => void; hideResign?: boolean; stakeAmount?: number }) {
  const [reporting, setReporting] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<"forfeit"|"report"|"resign"|"withdraw"|null>(null);
  const [msg, setMsg] = useState("");

  const penalty = stakeAmount ? Math.round(stakeAmount * 0.005 * 100) / 100 : null;
  const refund = stakeAmount && penalty !== null ? stakeAmount - penalty : null;

  async function claimForfeit() {
    setLoading("forfeit"); setMsg("");
    const res = await fetch("/api/matches/claim-forfeit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ match_id: matchId }) });
    const j = await res.json();
    setMsg(j.success ? "✅ Forfeit win claimed!" : "❌ " + j.message);
    setLoading(null);
    if (j.success) onMatchEnded?.();
  }

  async function confirmResign() {
    setLoading("resign"); setMsg("");
    const res = await fetch("/api/matches/resign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ match_id: matchId }) });
    const j = await res.json();
    setMsg(j.success ? "You resigned. Your stake was forfeited." : "❌ " + j.message);
    setLoading(null);
    setResigning(false);
    if (j.success) onMatchEnded?.();
  }

  async function confirmWithdraw() {
    setLoading("withdraw"); setMsg("");
    const res = await fetch("/api/matches/withdraw-locked", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ match_id: matchId }) });
    const j = await res.json();
    setMsg(j.success ? "✅ Stake withdrawn (0.5% penalty applied). Match ended." : "❌ " + j.message);
    setLoading(null);
    setWithdrawing(false);
    if (j.success) onMatchEnded?.();
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
        {!hideResign && (
          <button onClick={() => setResigning(v => !v)} disabled={loading === "resign"}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: "rgba(255,61,90,0.1)", border: "1px solid rgba(255,61,90,0.2)", color: "var(--lj-danger)" }}>
            <FlagOff size={12}/> Resign
          </button>
        )}
        <button onClick={() => setWithdrawing(v => !v)} disabled={loading === "withdraw"}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd" }}>
          <Coins size={12}/> Withdraw Stake
        </button>
      </div>

      {withdrawing && (
        <div className="space-y-2 rounded-xl p-3" style={{ background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.2)" }}>
          <div className="flex items-center gap-1.5 text-xs text-blue-300">
            <AlertTriangle size={12}/>
            {penalty !== null && refund !== null
              ? `Withdraw your locked stake now with a 0.5% early-exit penalty (${penalty.toLocaleString()} XAF). You'll get back ${refund.toLocaleString()} XAF and your opponent will be declared the winner. This can't be undone.`
              : "Withdraw your locked stake now with a 0.5% early-exit penalty. Your opponent will be declared the winner. This can't be undone."}
          </div>
          <div className="flex gap-2">
            <button onClick={confirmWithdraw} disabled={loading === "withdraw"}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "#3b82f6" }}>
              {loading === "withdraw" ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"/> : <Coins size={12}/>}
              Confirm Withdraw
            </button>
            <button onClick={() => setWithdrawing(false)} disabled={loading === "withdraw"}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-[var(--lj-muted)] hover:brightness-110 disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--lj-border)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {resigning && !hideResign && (
        <div className="space-y-2 rounded-xl p-3" style={{ background: "rgba(255,61,90,0.05)", border: "1px solid rgba(255,61,90,0.2)" }}>
          <div className="flex items-center gap-1.5 text-xs text-red-400"><AlertTriangle size={12}/> Resigning forfeits your stake to your opponent. This can&apos;t be undone.</div>
          <div className="flex gap-2">
            <button onClick={confirmResign} disabled={loading === "resign"}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "var(--lj-danger)" }}>
              {loading === "resign" ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"/> : <FlagOff size={12}/>}
              Confirm Resign
            </button>
            <button onClick={() => setResigning(false)} disabled={loading === "resign"}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-[var(--lj-muted)] hover:brightness-110 disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--lj-border)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
