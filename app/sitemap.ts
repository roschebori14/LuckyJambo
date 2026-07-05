import type { MetadataRoute } from "next";

// Same canonical URL used in app/layout.tsx's metadataBase - keep
// these in sync (or better, factor both out to a shared constant/env
// var once NEXT_PUBLIC_APP_URL is pointed at the real production
// domain instead of the Vercel preview URL).
const SITE_URL = "https://lucky-jambo.vercel.app";

// Only genuinely public, indexable pages belong here. Everything
// under (protected) - /games, /dashboard, /wallet, /deposit,
// /leaderboard, /matches, /friends, /profile, /ledger,
// /notifications - sits behind the auth middleware and redirects
// anonymous visitors (including search crawlers) to /login, so
// listing them would just waste crawl budget on 30x redirects. Admin
// routes are excluded for the same reason plus they're sensitive.
//
// /login, /register, /forgot-password, and /verify-email are public
// but intentionally left out too: they're utility/functional pages
// with no unique content to rank on, and indexing an auth form is a
// common source of low-quality-page warnings in Search Console. Add
// them back in (with a lower priority) if you specifically want
// "sign up" style queries to land directly on /register.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/legal/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
