"use client";

import { useState } from "react";
import { MINIMUM_DEPOSIT, MAXIMUM_DEPOSIT } from "@/lib/wallet/wallet-constants";
import { ArrowDownCircle, AlertCircle } from "lucide-react";

export default function DepositForm() {
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const quick = [500, 1000, 5000, 10000, 25000];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsed = Number(amount);
    if (!parsed || parsed < MINIMUM_DEPOSIT) {
      setError(`Minimum deposit is ${MINIMUM_DEPOSIT.toLocaleString()} XAF`);
      return;
    }
    if (parsed > MAXIMUM_DEPOSIT) {
      setError(`Maximum deposit is ${MAXIMUM_DEPOSIT.toLocaleString()} XAF`);
      return;
    }
    if (phone.length < 9) {
      setError("Enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/deposits/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, phone }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Failed to start deposit");
        return;
      }
      // Redirect to Fapshi's hosted payment page
      window.location.href = json.paymentLink;
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="lj-card p-5 space-y-4">
      <h2 className="text-lg font-bold text-white">Deposit Funds</h2>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">
          Amount (XAF)
        </label>
        <input
          type="number"
          min={MINIMUM_DEPOSIT}
          max={MAXIMUM_DEPOSIT}
          placeholder={`${MINIMUM_DEPOSIT.toLocaleString()} – ${MAXIMUM_DEPOSIT.toLocaleString()}`}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="lj-input"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {quick.map(v => (
            <button key={v} type="button" onClick={() => setAmount(String(v))}
              className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--lj-text)] transition-colors hover:bg-white/10"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              {v.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">
          MTN / Orange Phone Number
        </label>
        <input
          type="tel"
          placeholder="6XXXXXXXX"
          value={phone}
          onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
          className="lj-input"
        />
      </div>

      <p className="text-xs text-[var(--lj-muted)]">
        You&apos;ll be redirected to Fapshi to complete payment via MTN or Orange Mobile Money.
      </p>

      <button type="submit" disabled={loading || !amount || !phone}
        className="lj-btn-primary flex w-full items-center justify-center gap-2">
        {loading
          ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          : <ArrowDownCircle size={16} />}
        {loading ? "Starting payment…" : `Deposit ${amount ? Number(amount).toLocaleString() + " XAF" : ""}`}
      </button>
    </form>
  );
}
