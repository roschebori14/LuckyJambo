"use client";

/**
 * Lightweight, dependency-free cookie utilities plus a small consent
 * system (necessary / functional / analytics) modeled on standard
 * GDPR-style cookie banners.
 *
 * Everything here is client-only (`document.cookie`) since the banner,
 * the Tawk widget, and the login form all need to read/react to consent
 * synchronously in the browser without a round trip to the server.
 */

export type ConsentCategory = "functional" | "analytics";

export interface CookieConsent {
  /** Strictly-necessary cookies (auth session, this consent cookie itself) can't be disabled. */
  necessary: true;
  /** Cookies that remember preferences and power optional features (e.g. live chat, remember-me). */
  functional: boolean;
  /** Cookies used for aggregate analytics. Not currently wired to any provider, reserved for future use. */
  analytics: boolean;
  /** Bumped whenever the categories/copy change materially, to force re-consent. */
  version: number;
}

export const CONSENT_COOKIE_NAME = "lj_cookie_consent";
export const CONSENT_VERSION = 1;
export const CONSENT_EVENT = "lj-cookie-consent-changed";
/** Dispatched by the footer's "Cookie settings" link to reopen the banner on demand. */
export const OPEN_CONSENT_MANAGER_EVENT = "lj-open-cookie-settings";

const CONSENT_MAX_AGE_DAYS = 180;

// ---------------------------------------------------------------------------
// Generic cookie helpers (usable outside of the consent system too, e.g. for
// storing the "remember my email" preference).
// ---------------------------------------------------------------------------

export function setCookie(name: string, value: string, maxAgeDays: number) {
  if (typeof document === "undefined") return;
  const maxAgeSeconds = Math.round(maxAgeDays * 24 * 60 * 60);
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    `path=/`,
    `max-age=${maxAgeSeconds}`,
    `SameSite=Lax`,
    isHttps ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

export function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

// ---------------------------------------------------------------------------
// Consent state
// ---------------------------------------------------------------------------

/** Returns the saved consent, or null if the user hasn't decided yet (or the saved version is stale). */
export function getConsent(): CookieConsent | null {
  const raw = getCookie(CONSENT_COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    return { ...parsed, necessary: true };
  } catch {
    return null;
  }
}

export function hasConsentFor(category: ConsentCategory): boolean {
  return getConsent()?.[category] === true;
}

export function saveConsent(choices: { functional: boolean; analytics: boolean }) {
  const consent: CookieConsent = {
    necessary: true,
    functional: choices.functional,
    analytics: choices.analytics,
    version: CONSENT_VERSION,
  };
  setCookie(CONSENT_COOKIE_NAME, JSON.stringify(consent), CONSENT_MAX_AGE_DAYS);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
  }
  return consent;
}

export function acceptAllConsent() {
  return saveConsent({ functional: true, analytics: true });
}

export function rejectNonEssentialConsent() {
  return saveConsent({ functional: false, analytics: false });
}

/** Clears saved consent so the banner reappears (used by "reset" flows / debugging). */
export function clearConsent() {
  deleteCookie(CONSENT_COOKIE_NAME);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
  }
}

/** Tells any mounted <CookieConsentBanner /> to reopen, e.g. from a footer "Cookie settings" link. */
export function openCookieSettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_CONSENT_MANAGER_EVENT));
  }
}
