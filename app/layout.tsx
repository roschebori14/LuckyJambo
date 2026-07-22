import "./globals.css";
import { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import TawkWidget from "@/components/tawk-widget";
import CookieConsentBanner from "@/components/cookies/cookie-consent-banner";

// Without this, mobile browsers have no viewport meta tag to go on and
// fall back to treating the page as a ~980px desktop layout, then
// scale the whole thing down to fit the screen. Every tap target
// shrinks as a result - most noticeably on small, precise-tap
// surfaces like the draughts board's 32 squares, where a scaled-down
// board makes it easy to miss the intended square (or for a tap to
// register just outside any square's hit area) and see nothing
// happen. This is almost certainly why draughts moves have been
// reported as "not working" on mobile specifically - the click
// handler was never broken, taps just weren't landing where users
// expected them to. Setting the real viewport width fixes tap
// accuracy across the entire site, not just this one board.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const SITE_URL = "https://lucky-jambo.vercel.app";
const SITE_NAME = "Lucky Jambo";
const SITE_DESCRIPTION =
  "Cameroon's premier skill gaming platform. Challenge real players in Chess, Draughts, Dice, and more — win real cash instantly with automated Mobile Money payouts.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Lucky Jambo | Cameroon's Skill Gaming Platform",
    template: "%s | Lucky Jambo",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Lucky Jambo",
    "skill gaming Cameroon",
    "win real money games",
    "chess for money",
    "draughts online",
    "mobile money games",
    "Fapshi",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,

  // Google Search Console verification
  verification: {
    google: "GuH9YZ8faC7YFWacXXiERsEgvkRf5XAEXFzSzPno7kk",
  },

  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",

  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Lucky Jambo | Cameroon's Skill Gaming Platform",
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Lucky Jambo - Cameroon's Skill Gaming Platform",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Lucky Jambo | Cameroon's Skill Gaming Platform",
    description: SITE_DESCRIPTION,
    images: ["/images/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },

  alternates: {
    canonical: SITE_URL,
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        {children}
        <TawkWidget />
        <CookieConsentBanner />
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            style: {
              background: "#0a1428",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
            },
          }}
        />
      </body>
    </html>
  );
}
