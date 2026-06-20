# Lucky Jambo – Full Deployment Guide

## ✅ Build Status: PASSING (31 routes, 0 errors)

---

## STEP 1 — Supabase Setup (5 min)

1. Go to https://app.supabase.com → open your project
2. Click **SQL Editor** → New Query
3. Paste the entire contents of `supabase_schema.sql` and click **Run**
4. Go to **Authentication → Settings**:
   - Enable Email confirmations: ON
   - Site URL: `https://lucky-jambo.vercel.app`
   - Add Redirect URLs: `https://lucky-jambo.vercel.app/**`
5. Go to **Authentication → Email Templates** and customize if needed

---

## STEP 2 — Deploy to Vercel (3 min)

### Option A: Via Vercel CLI
```bash
npm i -g vercel
cd luckyjambo
vercel --prod
```

### Option B: Via GitHub (recommended)
1. Push this folder to a GitHub repo:
```bash
cd luckyjambo
git init
git add .
git commit -m "feat: initial Lucky Jambo build"
git remote add origin https://github.com/YOUR_USERNAME/luckyjambo.git
git push -u origin main
```
2. Go to https://vercel.com → New Project → Import your GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Add ALL environment variables from the list below

---

## STEP 3 — Environment Variables (paste into Vercel)

Go to Vercel → Project Settings → Environment Variables and add:

```
NEXT_PUBLIC_SUPABASE_URL=https://qukqhycnovirfevcubvy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_udJ5Krx6NNk2fsYniGgxLg_hanSDWZi
SUPABASE_SERVICE_ROLE_KEY=sb_secret_XxkSAinAhIsdhHhjNuU3sQ_JYg41qoq

FAPSHI_COLLECTION_KEY=d29980f9-1bfe-4a39-8d4e-b7e84789914d
FAPSHI_COLLECTION_SECRET=FAK_2401ccadb98e249ef29d216b29ecc986
FAPSHI_PAYOUT_KEY=b1abbaa5-7fc2-44ea-8527-a09ba7252f2e
FAPSHI_PAYOUT_SECRET=FAK_19dec5bb11037769314b75ea1fa4b426

RESEND_API_KEY=re_RaBgUkPu_9Je4xgokW6JScaag7sg1o5od
RESEND_FROM_EMAIL=noreply@luckyjambo.com

NEXT_PUBLIC_APP_URL=https://lucky-jambo.vercel.app
NEXT_PUBLIC_APP_NAME=LuckyJambo
NEXT_PUBLIC_PLATFORM_FEE=20
NEXT_PUBLIC_MIN_DEPOSIT=50
NEXT_PUBLIC_MAX_DEPOSIT=100000
NEXT_PUBLIC_MIN_WITHDRAWAL=500
NEXT_PUBLIC_MAX_WITHDRAWAL=100000
NEXT_PUBLIC_WHATSAPP=+237683187249
NEXT_PUBLIC_TELEGRAM=https://t.me/luckyjambo
```

---

## STEP 4 — Fapshi Webhook (2 min)

1. Log into your Fapshi dashboard
2. Go to **Webhooks / Callback URL**
3. Set URL to: `https://lucky-jambo.vercel.app/api/webhooks/fapshi`
4. This fires when a payment is completed, crediting user wallets automatically

---

## STEP 5 — Create Admin Account

1. Register normally at https://lucky-jambo.vercel.app/register
2. Go to Supabase → Table Editor → `profiles`
3. Find your user row and change `role` from `user` → `admin`
4. Now `/admin` is accessible to you

---

## STEP 6 — DNS / Custom Domain (optional)

In Vercel → Project Settings → Domains:
- Add `luckyjambo.com` or `www.luckyjambo.com`
- Update `NEXT_PUBLIC_APP_URL` env var to match
- Update Supabase Site URL and Redirect URLs to match

---

## What's Live

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/register` | Sign up |
| `/login` | Log in |
| `/dashboard` | Player home |
| `/games` | Browse all 5 games |
| `/matches` | My matches + public lobby |
| `/matches/new` | Create/challenge match |
| `/matches/[id]` | Live game arena |
| `/wallet` | Deposit / Withdraw / History |
| `/friends` | Friend requests & list |
| `/profile` | Edit profile |
| `/admin` | Admin panel (role=admin only) |
| `/api/webhooks/fapshi` | Payment webhook |
| `/terms` | Terms of service |
| `/privacy` | Privacy policy |
| `/responsible-gaming` | Responsible gaming |

## Games Available
- ♟️ Chess (via chess.js)
- ⭕ Tic Tac Toe (real-time)
- 🎲 Two Dice (real-time)
- 🪙 Coin Flip (real-time)
- 🔴 Draughts (board UI placeholder — logic extendable)

## Tech Stack
- **Frontend**: Next.js 15 App Router + Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase (PostgreSQL + Realtime)
- **Auth**: Supabase Auth (email/password)
- **Payments**: Fapshi (MTN MoMo + Orange Money)
- **Email**: Resend
- **Deployment**: Vercel

