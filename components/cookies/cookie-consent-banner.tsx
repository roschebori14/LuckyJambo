"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import {
  acceptAllConsent,
  getConsent,
  OPEN_CONSENT_MANAGER_EVENT,
  rejectNonEssentialConsent,
  saveConsent,
} from "@/lib/cookies/cookie-consent";

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

function ToggleRow({ label, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--lj-muted)]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
        style={{
          background: checked ? "var(--lj-blue)" : "rgba(255,255,255,0.15)",
        }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [functional, setFunctional] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const existing = getConsent();
    if (!existing) {
      setVisible(true);
    } else {
      setFunctional(existing.functional);
      setAnalytics(existing.analytics);
    }

    function handleOpenRequest() {
      const current = getConsent();
      setFunctional(current?.functional ?? false);
      setAnalytics(current?.analytics ?? false);
      setExpanded(true);
      setVisible(true);
    }

    window.addEventListener(OPEN_CONSENT_MANAGER_EVENT, handleOpenRequest);
    return () => window.removeEventListener(OPEN_CONSENT_MANAGER_EVENT, handleOpenRequest);
  }, []);

  if (!visible) return null;

  function close() {
    setVisible(false);
    setExpanded(false);
  }

  function handleAcceptAll() {
    acceptAllConsent();
    close();
  }

  function handleRejectNonEssential() {
    rejectNonEssentialConsent();
    close();
  }

  function handleSavePreferences() {
    saveConsent({ functional, analytics });
    close();
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-4"
    >
      <div
        className="w-full max-w-2xl rounded-2xl p-5 shadow-2xl"
        style={{
          background: "var(--lj-navy-3)",
          border: "1px solid var(--lj-border)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--lj-card)" }}
          >
            <Cookie size={18} style={{ color: "var(--lj-cyan)" }} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">We use cookies</p>
            <p className="mt-1 text-xs leading-5 text-[var(--lj-muted)]">
              We use necessary cookies to keep you signed in and the site running. With your
              permission we&rsquo;d also like to use functional cookies (e.g. live chat,
              remembering your email) and analytics cookies to improve Lucky Jambo. See our{" "}
              <Link href="/legal/cookies" className="text-[var(--lj-blue-2)] hover:underline">
                Cookie Policy
              </Link>{" "}
              for details.
            </p>

            {expanded && (
              <div className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10 px-3">
                <ToggleRow
                  label="Necessary"
                  description="Required for login, security, and core functionality. Always on."
                  checked
                  disabled
                />
                <ToggleRow
                  label="Functional"
                  description="Powers optional features like live chat support and remembering your email at login."
                  checked={functional}
                  onChange={setFunctional}
                />
                <ToggleRow
                  label="Analytics"
                  description="Helps us understand how the site is used so we can improve it. Not currently active."
                  checked={analytics}
                  onChange={setAnalytics}
                />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button onClick={handleAcceptAll} className="lj-btn-primary !w-auto px-4 py-2 text-sm">
                Accept all
              </button>
              <button
                onClick={handleRejectNonEssential}
                className="rounded-xl border px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                style={{ borderColor: "var(--lj-border)" }}
              >
                Reject non-essential
              </button>
              {expanded ? (
                <button
                  onClick={handleSavePreferences}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                  style={{ borderColor: "var(--lj-border)" }}
                >
                  Save preferences
                </button>
              ) : (
                <button
                  onClick={() => setExpanded(true)}
                  className="px-2 py-2 text-sm font-semibold text-[var(--lj-blue-2)] hover:text-[var(--lj-cyan)]"
                >
                  Customize
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleRejectNonEssential}
            aria-label="Dismiss (rejects non-essential cookies)"
            className="shrink-0 text-[var(--lj-muted)] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
