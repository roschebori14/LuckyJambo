# Lucky Jambo – Deployment Guide

**Play • Compete • Win** – Cameroon's P2P Skill Gaming Platform

---

## STEP 1: Set Up Supabase

1. Go to supabase.com → New Project
2. Copy Project URL and anon key from Settings → API
3. Copy service_role key (keep this secret!)
4. Go to SQL Editor → paste entire contents of supabase_schema.sql → Run
5. Authentication → URL Configuration → set Site URL to your Vercel URL

## STEP 2: Deploy to Vercel

```bash
npm install -g vercel
vercel login
cd luckyjambo
vercel
```

Set these environment variables in Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL         = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY    = eyJ...
SUPABASE_SERVICE_ROLE_KEY        = eyJ...
FAPSHI_COLLECTION_KEY            = d29980f9-1bfe-4a39-8d4e-b7e84789914d
FAPSHI_COLLECTION_SECRET         = FAK_2401ccadb98e249ef29d216b29ecc986
FAPSHI_PAYOUT_KEY                = b1abbaa5-7fc2-44ea-8527-a09ba7252f2e
FAPSHI_PAYOUT_SECRET             = FAK_19dec5bb11037769314b75ea1fa4b426
RESEND_API_KEY                   = re_RaBgUkPu_9Je4xgokW6JScaag7sg1o5od
RESEND_FROM_EMAIL                = noreply@luckyjambo.com
NEXT_PUBLIC_APP_URL              = https://your-app.vercel.app
```

## STEP 3: Set Up Fapshi Webhook

In fapshi.com dashboard → Webhooks → Add:
https://your-app.vercel.app/api/webhooks/fapshi

## STEP 4: Create Admin Account

1. Register normally at /register
2. In Supabase Table Editor → profiles → find your user → change role to "admin"

## STEP 5: Go Live

vercel --prod
