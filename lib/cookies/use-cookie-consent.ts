"use client";

import { useEffect, useState } from "react";
import { CONSENT_EVENT, CookieConsent, getConsent } from "./cookie-consent";

/** Reactive read-only view of the visitor's current cookie consent. Re-renders whenever it changes. */
export function useCookieConsent() {
  const [consent, setConsentState] = useState<CookieConsent | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Cookies aren't available during SSR, so read them after mount.
    setConsentState(getConsent());
    setHydrated(true);

    function handleChange(e: Event) {
      const detail = (e as CustomEvent<CookieConsent | null>).detail;
      setConsentState(detail ?? getConsent());
    }

    window.addEventListener(CONSENT_EVENT, handleChange);
    return () => window.removeEventListener(CONSENT_EVENT, handleChange);
  }, []);

  return {
    consent,
    hydrated,
    functionalAllowed: consent?.functional === true,
    analyticsAllowed: consent?.analytics === true,
  };
}
