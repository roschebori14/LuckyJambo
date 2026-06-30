# Lucky Jambo Architecture

## Overview

Lucky Jambo is a Cameroon-focused peer-to-peer skill gaming platform.

Players can:

- Register accounts
- Deposit funds
- Maintain wallet balances
- Add friends
- Challenge friends
- Join public matches
- Play skill-based games
- Win money
- Withdraw funds

The platform acts as an escrow between players.

---

# Technology Stack

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Zustand
- TanStack Table
- Chart.js

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

## Email

- Resend

## Payments

- Fapshi Collection API
- Fapshi Payout API

## Hosting

- Vercel

---

# High-Level Architecture

Client
↓
Next.js Frontend
↓
API Routes / Server Actions
↓
Supabase
↓
PostgreSQL

External Services:

Frontend
↓
Fapshi API
↓
Mobile Money Networks

Frontend
↓
Resend
↓
Email Delivery

---

# Authentication Flow

User Registers
↓
Supabase Auth
↓
Email Verification
↓
Profile Creation
↓
Wallet Creation

---

# Deposit Flow

User Deposit Request
↓
Fapshi Collection API
↓
User Pays
↓
Fapshi Webhook
↓
Verify Payment
↓
Create Deposit Record
↓
Create Ledger Entry
↓
Update Wallet

---

# Withdrawal Flow

User Requests Withdrawal
↓
Validate Balance
↓
Create Withdrawal Request
↓
Admin Approval
↓
Fapshi Payout API
↓
Ledger Entry
↓
Wallet Update
↓
Completed

---

# Wallet Architecture

Each wallet contains:

available_balance

locked_balance

Example:

available = 5000

locked = 1000

total = 6000

---

# Match Flow

Create Match
↓
Stake Locked
↓
Opponent Joins
↓
Game Starts
↓
Game Ends
↓
Winner Determined
↓
Settlement Executed
↓
Ledger Updated

---

# Revenue Model

Player A Stake = 1000

Player B Stake = 1000

Total Pot = 2000

Platform Fee = 5%

Fee = 100

Winner Receives = 1900

Platform Revenue = 100

---

# Security

All money calculations run server-side.

Never trust client values.

Implement:

- Row Level Security
- CSRF Protection
- Rate Limiting
- Secure Cookies
- Input Validation
- Zod Validation
- JWT Validation

---

# Scalability

Future Games:

- Connect Four
- Checkers Variants
- Card Games
- Quiz Battles
- Tournaments

The system is designed so new games can be added without modifying the wallet architecture.

---

# Deployment

Frontend:
Vercel

Backend:
Next.js API Routes

Database:
Supabase PostgreSQL

Storage:
Supabase Storage

Payments:
Fapshi

Emails:
Resend

Monitoring:
Vercel Analytics
