"use client";

import { deleteCookie, getCookie, hasConsentFor, setCookie } from "./cookie-consent";

const REMEMBERED_EMAIL_COOKIE = "lj_remembered_email";
const REMEMBERED_EMAIL_MAX_AGE_DAYS = 30;

/** Reads the remembered login email, if any was saved (and functional cookies are still allowed). */
export function getRememberedEmail(): string {
  if (!hasConsentFor("functional")) return "";
  return getCookie(REMEMBERED_EMAIL_COOKIE) ?? "";
}

/**
 * Saves (or clears) the email to prefill on the login page next time.
 * No-ops if the visitor hasn't opted into functional cookies - the checkbox
 * still works for the current session, it just won't persist across visits.
 */
export function setRememberedEmail(email: string, remember: boolean) {
  if (!remember) {
    deleteCookie(REMEMBERED_EMAIL_COOKIE);
    return;
  }
  if (!hasConsentFor("functional")) return;
  setCookie(REMEMBERED_EMAIL_COOKIE, email, REMEMBERED_EMAIL_MAX_AGE_DAYS);
}
