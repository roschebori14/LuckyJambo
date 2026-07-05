# SEO: sitemap + robots

Drop both files straight into your `app/` folder root (next to
`app/layout.tsx`):

- `app/sitemap.ts` — Next.js auto-serves this at `/sitemap.xml`.
- `app/robots.ts` — Next.js auto-serves this at `/robots.txt`.

No new dependencies, no config changes needed - this is the native
Next.js App Router convention (`MetadataRoute.Sitemap` /
`MetadataRoute.Robots`), supported out of the box since Next 13.3.

## What's included and why

Only 4 URLs are in the sitemap: the homepage, `/contact`,
`/legal/terms`, `/legal/privacy`. Everything else in the app is either:
- **Behind login** (`/games`, `/dashboard`, `/wallet`, `/deposit`,
  `/matches`, `/leaderboard`, `/friends`, `/profile`, `/ledger`,
  `/notifications`) - a crawler hitting these gets redirected to
  `/login` by your auth middleware, so listing them in a sitemap only
  wastes crawl budget and can look odd in Search Console.
- **Admin-only** (`/admin/*`) - excluded and explicitly disallowed.
- **Auth utility pages** (`/login`, `/register`, `/forgot-password`,
  `/verify-email`) - technically public but no unique content to rank
  on. Left out on purpose; see the comment in `sitemap.ts` if you want
  `/register` indexed for "sign up" queries.

`robots.ts` explicitly disallows crawling all of the above so
crawlers don't burn time on pages that will just redirect them, and
points crawlers at the sitemap.

## One thing worth fixing first

Both files hardcode `SITE_URL = "https://lucky-jambo.vercel.app"` -
that's copied directly from the constant already in `app/layout.tsx`,
which is presumably a placeholder/preview URL rather than your real
production domain (your email addresses are `@luckyjambo.com`, for
instance). Before this goes live:
1. Point `NEXT_PUBLIC_APP_URL` at your real production domain.
2. Update `SITE_URL` in `app/layout.tsx`, `sitemap.ts`, and `robots.ts`
   to match (or better, have all three read from
   `process.env.NEXT_PUBLIC_APP_URL` so there's one source of truth
   instead of three hardcoded copies - happy to make that change if
   you want).
3. Submit `https://<your-domain>/sitemap.xml` in Google Search Console
   / Bing Webmaster Tools.
