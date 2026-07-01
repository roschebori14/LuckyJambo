"use client";
import { useState } from "react";
import { MINIMUM_WITHDRAWAL, MAXIMUM_WITHDRAWAL } from "@/lib/wallet/wallet-constants";
import { ArrowUpCircle, AlertCircle, Zap } from "lucide-react";

export default function WithdrawalForm({ availableBalance, autoMax }: { availableBalance: number; autoMax?: number }) {
  const [amount, setAmount] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [provider, setProvider] = useState<"mtn"|"orange">("mtn");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [autoProcessed, setAutoProcessed] = useState(false);

  const quick = [500, 1000, 5000, 10000].filter(v => v <= availableBalance);

  async function handleSubmit() {
    setError(""); setSuccess("");
    const parsed = Number(amount);
    if (!parsed || parsed < MINIMUM_WITHDRAWAL) { setError(`Minimum withdrawal is ${MINIMUM_WITHDRAWAL.toLocaleString()} XAF`); return; }
    if (parsed > MAXIMUM_WITHDRAWAL) { setError(`Maximum is ${MAXIMUM_WITHDRAWAL.toLocaleString()} XAF`); return; }
    if (parsed > availableBalance) { setError("Insufficient balance"); return; }
    if (!/^\d{9,15}$/.test(accountNumber)) { setError("Enter a valid phone number (9–15 digits)"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/withdrawals/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, account_number: accountNumber, provider }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.message); return; }
      setAutoProcessed(json.autoProcessed);
      setSuccess(json.autoProcessed
        ? `✅ ${parsed.toLocaleString()} XAF sent instantly to your ${provider.toUpperCase()} number!`
        : "✅ Withdrawal request submitted. Pending admin approval."
      );
      setAmount(""); setAccountNumber("");
    } finally { setLoading(false); }
  }

  return (
    <div className="lj-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Withdraw Funds</h2>
        {autoMax && autoMax > 0 && (
          <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold text-yellow-300"
            style={{ background: "rgba(253,224,71,0.1)", border: "1px solid rgba(253,224,71,0.2)" }}>
            <Zap size={10} /> Auto-pay up to {autoMax.toLocaleString()} XAF
          </span>
        )}
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"><AlertCircle size={16}/> {error}</div>}
      {success && <div className={`rounded-xl px-4 py-3 text-sm font-medium ${autoProcessed ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-blue-500/10 text-blue-300"}`}>{success}</div>}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">Amount (XAF)</label>
        <input type="number" min={MINIMUM_WITHDRAWAL} max={Math.min(MAXIMUM_WITHDRAWAL, availableBalance)}
          placeholder={`${MINIMUM_WITHDRAWAL.toLocaleString()} – ${Math.min(MAXIMUM_WITHDRAWAL, availableBalance).toLocaleString()}`}
          value={amount} onChange={e => setAmount(e.target.value)} className="lj-input" />
        {quick.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {quick.map(v => (
              <button key={v} type="button" onClick={() => setAmount(String(v))}
                className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--lj-text)] hover:bg-white/10 transition-colors"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                {v.toLocaleString()}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">Provider</label>
        <div className="grid grid-cols-2 gap-2">
          {(["mtn","orange"] as const).map(p => (
            <button key={p} type="button" onClick={() => setProvider(p)}
              className={`rounded-xl border-2 py-3 text-sm font-semibold transition-all ${provider === p
                ? p === "mtn" ? "border-yellow-400 bg-yellow-400/10 text-yellow-300" : "border-orange-400 bg-orange-400/10 text-orange-300"
                : "border-[var(--lj-border)] text-[var(--lj-muted)] hover:border-white/20"}`}>
              {p === "mtn" ? "📱 MTN MoMo" : "🟠 Orange Money"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">
          {provider === "mtn" ? "MTN" : "Orange"} Phone Number
        </label>
        <input type="tel" placeholder="6XXXXXXXX" value={accountNumber}
          onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ""))} className="lj-input" />
      </div>

      <button onClick={handleSubmit} disabled={loading || !amount || !accountNumber}
        className="lj-btn-primary flex w-full items-center justify-center gap-2">
        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/> : <ArrowUpCircle size={16}/>}
        {loading ? "Processing…" : `Withdraw ${amount ? Number(amount).toLocaleString() + " XAF" : ""}`}
      </button>
    </div>
  );
}
