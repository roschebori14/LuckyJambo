"use client";

import { useState } from "react";
import { MINIMUM_WITHDRAWAL, MAXIMUM_WITHDRAWAL } from "@/lib/wallet/wallet-constants";

export default function WithdrawalForm({ availableBalance }: { availableBalance: number }) {
  const [amount, setAmount] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [provider, setProvider] = useState<"mtn" | "orange">("mtn");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit() {
    setError(""); setSuccess(""); setLoading(true);
    try {
      const parsed = Number(amount);
      if (!parsed || parsed < MINIMUM_WITHDRAWAL) {
        setError(`Minimum withdrawal is ${MINIMUM_WITHDRAWAL.toLocaleString()} XAF`); return;
      }
      if (parsed > MAXIMUM_WITHDRAWAL) {
        setError(`Maximum withdrawal is ${MAXIMUM_WITHDRAWAL.toLocaleString()} XAF`); return;
      }
      if (parsed > availableBalance) {
        setError("Insufficient balance"); return;
      }
      if (!/^\d{9,15}$/.test(accountNumber)) {
        setError("Enter a valid phone number (9–15 digits)"); return;
      }

      const res = await fetch("/api/withdrawals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, account_number: accountNumber, provider }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.message); return; }

      setSuccess("✅ Withdrawal request submitted. Funds locked pending admin approval.");
      setAmount(""); setAccountNumber("");
    } finally {
      setLoading(false);
    }
  }

  const quick = [500, 1000, 5000, 10000].filter(v => v <= availableBalance);

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-5">
      <h2 className="text-lg font-bold text-gray-900">Withdraw Funds</h2>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      {/* Amount */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Amount (XAF)
        </label>
        <input
          type="number"
          min={MINIMUM_WITHDRAWAL}
          max={Math.min(MAXIMUM_WITHDRAWAL, availableBalance)}
          placeholder={`${MINIMUM_WITHDRAWAL.toLocaleString()} – ${Math.min(MAXIMUM_WITHDRAWAL, availableBalance).toLocaleString()}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
        />
        {quick.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {quick.map(v => (
              <button key={v} type="button"
                onClick={() => setAmount(String(v))}
                className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-green-50 hover:text-green-700">
                {v.toLocaleString()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Provider */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Provider
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["mtn", "orange"] as const).map(p => (
            <button key={p} type="button"
              onClick={() => setProvider(p)}
              className={`rounded-xl border-2 py-3 text-sm font-semibold transition-all ${
                provider === p
                  ? p === "mtn" ? "border-yellow-400 bg-yellow-50 text-yellow-800"
                                : "border-orange-400 bg-orange-50 text-orange-800"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}>
              {p === "mtn" ? "📱 MTN MoMo" : "🟠 Orange Money"}
            </button>
          ))}
        </div>
      </div>

      {/* Phone number */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {provider === "mtn" ? "MTN" : "Orange"} Phone Number
        </label>
        <input
          type="tel"
          placeholder={provider === "mtn" ? "6XXXXXXXX" : "6XXXXXXXX"}
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
        />
      </div>

      <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
        ⚠️ Withdrawals are reviewed by an admin before payout. Funds are locked while pending.
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !amount || !accountNumber}
        className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? "Submitting…" : `Withdraw ${amount ? Number(amount).toLocaleString() + " XAF" : ""}`}
      </button>
    </div>
  );
}
