"use client";

import { ReactNode } from "react";
import { openCookieSettings } from "@/lib/cookies/cookie-consent";

interface CookieSettingsLinkProps {
  children: ReactNode;
  className?: string;
}

/** Inline button that reopens the <CookieConsentBanner /> so visitors can change their choices later. */
export default function CookieSettingsLink({ children, className }: CookieSettingsLinkProps) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      {children}
    </button>
  );
}
