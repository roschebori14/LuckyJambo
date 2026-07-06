"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PaymentLinkCard from "./payment-link-card";
import PaymentStatus from "./payment-status";
import { MINIMUM_DEPOSIT, MAXIMUM_DEPOSIT } from "@/lib/wallet/wallet-constants";
import { useSound } from "@/lib/sound/sound-manager";

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // give up polling after 5 minutes

type Phase = "form" | "reconciling" | "awaiting-payment" | "completed" | "failed";

interface DepositFormProps {
  // Fapshi's redirectUrl sends the user back here as ?ref=<payment_reference>
  // after they leave the hosted payment page. The in-memory polling state
  // from the original submit is gone at that point (full navigation), so
  // this is what lets us pick reconciliation back up.
  pendingReference?: string;
}

export default function DepositForm({ pendingReference }: DepositFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>(pendingReference ? "reconciling" : "form");
  const { play } = useSound();

  // "deposit-success" is defined in the sound catalog but nothing
  // called it - centralizing it on the phase transition (rather than
  // at each of the two setPhase("completed") call sites above) means
  // any future success path added to this component gets the sound
  // for free too.
  const playedSuccessRef = useRef(false);
  useEffect(() => {
    if (phase === "completed" && !playedSuccessRef.current) {
      playedSuccessRef.current = true;
      play("deposit-success");
    }
    if (phase !== "completed") playedSuccessRef.current = false;
  }, [phase, play]);
  const [paymentLink, setPaymentLink] = useState("");
  const [transId, setTransId] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Generic poller: `check` runs once per tick and returns the latest
  // status, used for both the transId-based flow (fresh submit, still on
  // this page) and the reference-based flow (returned via redirect).
  function startPolling(check: () => Promise<{ success: boolean; status?: string; amount?: number }>) {
    pollRef.current = setInterval(async () => {
      try {
        const json = await check();
        if (!json.success) return;

        if (json.status === "SUCCESSFUL") {
          setPhase("completed");
          setConfirmedAmount(json.amount ?? 0);
          if (pollRef.current) clearInterval(pollRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          router.refresh();
        } else if (json.status === "FAILED" || json.status === "EXPIRED") {
          setPhase("failed");
          if (pollRef.current) clearInterval(pollRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
      } catch {
        // transient network error - keep polling until timeout
      }
    }, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
    }, POLL_TIMEOUT_MS);
  }

  async function verifyByTransId(id: string) {
    const res = await fetch("/api/fapshi/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transId: id }),
    });
    return res.json();
  }

  async function verifyByReference(reference: string) {
    const res = await fetch("/api/deposits/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    });
    return res.json();
  }

  // On landing back from Fapshi's hosted page, immediately reconcile the
  // deposit by its reference, then keep polling in case Fapshi hasn't
  // confirmed the transaction yet on their end.
  useEffect(() => {
    if (!pendingReference) return;

    let cancelled = false;

    (async () => {
      try {
        const json = await verifyByReference(pendingReference);
        if (cancelled) return;

        if (!json.success) {
          setPhase("form");
          return;
        }

        if (json.status === "SUCCESSFUL") {
          setPhase("completed");
          setConfirmedAmount(json.amount ?? 0);
          router.replace("/wallet/deposit");
          router.refresh();
          return;
        }

        if (json.status === "FAILED" || json.status === "EXPIRED") {
          setPhase("failed");
          return;
        }

        // Still PENDING on Fapshi's side - keep checking.
        setPhase("awaiting-payment");
        setAmount(String(json.amount ?? ""));
        startPolling(() => verifyByReference(pendingReference));
      } catch {
        if (!cancelled) setPhase("form");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingReference]);

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
      const res = await fetch("/api/fapshi/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, phone }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message ?? "Could not start payment. Please try again.");
        return;
      }

      setPaymentLink(json.paymentLink);
      setTransId(json.transId);
      setPhase("awaiting-payment");
      startPolling(() => verifyByTransId(json.transId));
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPhase("form");
    setAmount("");
    setError("");
    setPaymentLink("");
    setTransId("");
  }

  if (phase === "reconciling") {
    return (
      <div className="lj-card space-y-4 p-5">
        <h2 className="text-lg font-bold text-white">Checking your payment…</h2>
        <PaymentStatus status="pending" />
      </div>
    );
  }

  if (phase === "awaiting-payment" || phase === "completed" || phase === "failed") {
    return (
      <div className="lj-card space-y-4 p-5">
        <h2 className="text-lg font-bold text-white">Deposit {Number(amount).toLocaleString()} XAF</h2>

        {phase === "awaiting-payment" && (
          <>
            {paymentLink && <PaymentLinkCard paymentLink={paymentLink} amount={Number(amount)} />}
            <PaymentStatus status="pending" />
          </>
        )}

        {phase === "completed" && (
          <PaymentStatus status="completed" />
        )}

        {phase === "failed" && (
          <>
            <PaymentStatus status="failed" />
            <button
              onClick={reset}
              className="lj-btn-primary w-full"
            >
              Try Again
            </button>
          </>
        )}

        {phase === "completed" && (
          <button
            onClick={reset}
            className="w-full rounded-xl py-3 text-sm font-bold text-[var(--lj-text)] transition-colors hover:bg-white/5"
            style={{ border: "1px solid var(--lj-border)" }}
          >
            Make Another Deposit
          </button>
        )}
      </div>
    );
  }

  const quick = QUICK_AMOUNTS.filter((v) => v <= MAXIMUM_DEPOSIT);

  return (
    <form onSubmit={handleSubmit} className="lj-card space-y-5 p-5">
      <h2 className="text-lg font-bold text-white">Deposit Funds</h2>

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(255, 61, 90, 0.1)", color: "var(--lj-danger)" }}
        >
          {error}
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
          onChange={(e) => setAmount(e.target.value)}
          className="lj-input"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {quick.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(String(v))}
              className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--lj-text)] transition-colors hover:text-white"
              style={{
                background: amount === String(v) ? "var(--lj-blue)" : "rgba(255,255,255,0.05)",
              }}
            >
              {v.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div
        className="rounded-xl px-4 py-3 text-xs"
        style={{ background: "rgba(26, 86, 255, 0.1)", color: "var(--lj-blue-2)" }}
      >
        📱 You&apos;ll be redirected to Fapshi to pay with MTN MoMo or Orange Money.
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">
          MTN / Orange Phone Number
        </label>
        <input
          type="tel"
          placeholder="6XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          className="lj-input"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !amount || !phone}
        className="lj-btn-primary w-full"
      >
        {loading ? "Starting payment…" : `Continue to Payment${amount ? ` — ${Number(amount).toLocaleString()} XAF` : ""}`}
      </button>
    </form>
  );
}
