"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useCookieConsent } from "@/lib/cookies/use-cookie-consent";

declare global {
  interface Window {
    Tawk_API?: {
      showWidget?: () => void;
      hideWidget?: () => void;
      onLoad?: () => void;
    };
    Tawk_LoadStart?: Date;
  }
}

// Only show the chat bubble on these routes. Add more paths if needed.
const TAWK_VISIBLE_PATHS = ["/"];

export default function TawkWidget() {
  const pathname = usePathname();
  const { functionalAllowed, hydrated } = useCookieConsent();

  useEffect(() => {
    if (!functionalAllowed) return;

    const shouldShow = TAWK_VISIBLE_PATHS.includes(pathname);

    const applyVisibility = () => {
      if (!window.Tawk_API) return;
      if (shouldShow) {
        window.Tawk_API.showWidget?.();
      } else {
        window.Tawk_API.hideWidget?.();
      }
    };

    if (window.Tawk_API?.showWidget) {
      // Widget already loaded (e.g. navigating between pages) - just toggle it.
      applyVisibility();
    } else if (window.Tawk_API) {
      // Script tag is in the DOM but the external widget hasn't finished
      // loading yet - apply visibility as soon as it's ready.
      window.Tawk_API.onLoad = applyVisibility;
    }
  }, [pathname, functionalAllowed]);

  // Tawk sets its own third-party cookies once it loads, so don't inject the
  // script at all until the visitor has consented to functional cookies (and
  // wait for the consent cookie to be read client-side first).
  if (!hydrated || !functionalAllowed) return null;

  return (
    <Script
      id="tawk-to"
      strategy="afterInteractive"
      onReady={() => {
        // Runs once, right after the inline script below has executed.
        // Hide the widget immediately if we're not on a page that should show it,
        // so there's no flash of the bubble before the effect above runs.
        if (window.Tawk_API) {
          window.Tawk_API.onLoad = () => {
            if (!TAWK_VISIBLE_PATHS.includes(window.location.pathname)) {
              window.Tawk_API?.hideWidget?.();
            }
          };
        }
      }}
    >
      {`
        var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
        (function(){
          var s1=document.createElement("script"),
              s0=document.getElementsByTagName("script")[0];
          s1.async=true;
          s1.src='https://embed.tawk.to/6a469854c5bc5d1d4917960e/default';
          s1.charset='UTF-8';
          s1.setAttribute('crossorigin','*');
          s0.parentNode.insertBefore(s1,s0);
        })();
      `}
    </Script>
  );
}
