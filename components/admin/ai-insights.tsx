"use client";

import { useState, useEffect } from "react";
import { Sparkles, Send, RefreshCw, AlertTriangle } from "lucide-react";

export default function AdminAIInsights() {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  async function fetchSummary() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/admin-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) setSummary(json.answer);
      else setError(json.message);
    } catch {
      setError("Failed to load AI insights.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSummary(); }, []);

  async function askQuestion() {
    if (!question.trim() || asking) return;
    setAsking(true);
    setAnswer("");
    setError("");
    try {
      const res = await fetch("/api/ai/admin-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const json = await res.json();
      if (json.success) setAnswer(json.answer);
      else setError(json.message);
    } catch {
      setError("Failed to get an answer.");
    } finally {
      setAsking(false);
      setQuestion("");
    }
  }

  return (
    <div className="lj-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-white">
          <Sparkles size={16} style={{ color: "var(--lj-cyan)" }} /> AI Platform Insights
        </h3>
        <button onClick={fetchSummary} disabled={loading}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-[var(--lj-muted)] transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-[var(--lj-muted)]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Analyzing platform data…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-red-400" style={{ background: "rgba(255,61,90,0.1)" }}>
          <AlertTriangle size={14} /> {error}
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--lj-text)]">{summary}</p>
      )}

      {answer && (
        <div className="mt-4 rounded-xl p-3 text-sm" style={{ background: "rgba(26,86,255,0.08)", border: "1px solid var(--lj-border)" }}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--lj-cyan)]">Answer</p>
          <p className="whitespace-pre-wrap text-[var(--lj-text)]">{answer}</p>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && askQuestion()}
          placeholder="Ask about deposits, withdrawals, suspicious activity…"
          disabled={asking}
          className="lj-input flex-1 text-sm"
        />
        <button onClick={askQuestion} disabled={asking || !question.trim()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, var(--lj-blue), var(--lj-cyan))" }}>
          {asking ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send size={15} />}
        </button>
      </div>
      <p className="mt-2 text-[10px] text-[var(--lj-muted)]">
        AI suggestions are informational only — always verify before taking action on a user's account.
      </p>
    </div>
  );
}
