import type { MetadataRoute } from "next";

const SITE_URL = "https://lucky-jambo.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/wallet",
          "/deposit",
          "/games",
          "/matches",
          "/leaderboard",
          "/friends",
          "/profile",
          "/ledger",
          "/notifications",
          "/admin",
          "/api",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
