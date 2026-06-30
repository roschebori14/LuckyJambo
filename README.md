# Lucky Jambo

A Cameroon-focused peer-to-peer skill gaming platform where players can challenge friends, compete in skill-based games, stake funds, and win real money.

---

## Features

### Authentication

- User Registration
- User Login
- Password Reset
- Email Verification

### Wallet System

- Mobile Money Deposits
- Mobile Money Withdrawals
- Wallet Ledger
- Transaction History

### Social Features

- Friend Requests
- Friends List
- User Search
- Online Status

### Matchmaking

- Friend Challenges
- Public Matchmaking
- Stake-Based Matches

### Games

Version 1:

- Chess
- Draughts
- Tic Tac Toe
- Dice

### Admin Dashboard

- User Management
- Deposits
- Withdrawals
- Matches
- Revenue Tracking
- Reports
- Settings

---

# Technology Stack

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Zustand

## Backend

- Next.js API Routes
- Server Actions

## Database

- Supabase PostgreSQL

## Authentication

- Supabase Auth

## Realtime

- Supabase Realtime

## Storage

- Supabase Storage

## Payments

- Fapshi Collection API
- Fapshi Payout API

## Email

- Resend

## Hosting

- Vercel

---

# Installation

Clone repository:

```bash
git clone <repository-url>

cd lucky-jambo
```

Install dependencies:

```bash
npm install
```

Create environment file:

```bash
cp .env.example .env.local
```

Fill in all required values.

---

# Database Setup

Run:

```sql
001_initial_schema.sql

002_rls_policies.sql
```

inside Supabase SQL Editor.

---

# Start Development Server

```bash
npm run dev
```

Application:

http://localhost:3000

---

# Project Structure

```text
app/
components/
lib/
types/
docs/

supabase/
├── migrations/
└── seed.sql
```

---

# Wallet Rules

Every balance change must create a ledger record.

Never update balances directly.

Allowed flow:

Deposit
→ Ledger Entry
→ Balance Update

Withdrawal
→ Ledger Entry
→ Balance Update

Match Settlement
→ Ledger Entry
→ Balance Update

---

# Revenue Model

Example:

Player A Stake = 1000 XAF

Player B Stake = 1000 XAF

Pot = 2000 XAF

Platform Fee = 5%

Fee = 100 XAF

Winner Receives = 1900 XAF

Platform Revenue = 100 XAF

---

# Security

Implemented:

- Supabase RLS
- JWT Authentication
- Secure Cookies
- Input Validation
- Server-Side Validation
- CSRF Protection
- Rate Limiting

---

# Deployment

Frontend:
Vercel

Database:
Supabase

Payments:
Fapshi

Emails:
Resend

Storage:
Supabase Storage

---

# License

Copyright © Lucky Jambo

All rights reserved.