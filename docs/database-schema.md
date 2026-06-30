# Lucky Jambo Database Schema

## Overview

Lucky Jambo uses Supabase PostgreSQL as its primary database.

All money-related operations are stored permanently and auditable through the wallet ledger system.

---

# Entity Relationship Overview

auth.users
│
└── profiles
│
├── wallets
│ └── wallet_ledger
│
├── deposits
├── withdrawals
├── transactions
│
├── friend_requests
├── friends
│
├── match_participants
│
├── notifications
│
└── reports

games
│
└── matches
│
└── match_participants

---

# profiles

Stores public and account information.

| Column      | Type        |
| ----------- | ----------- |
| id          | uuid        |
| email       | text        |
| username    | text        |
| full_name   | text        |
| avatar_url  | text        |
| phone       | text        |
| country     | text        |
| is_verified | boolean     |
| is_banned   | boolean     |
| role        | text        |
| created_at  | timestamptz |
| updated_at  | timestamptz |

---

# wallets

Stores user balances.

| Column            | Type        |
| ----------------- | ----------- |
| id                | uuid        |
| user_id           | uuid        |
| available_balance | numeric     |
| locked_balance    | numeric     |
| created_at        | timestamptz |
| updated_at        | timestamptz |

---

# wallet_ledger

Stores every balance movement.

No balance change is allowed without a ledger entry.

| Column         | Type        |
| -------------- | ----------- |
| id             | uuid        |
| wallet_id      | uuid        |
| user_id        | uuid        |
| type           | text        |
| amount         | numeric     |
| balance_before | numeric     |
| balance_after  | numeric     |
| reference      | text        |
| description    | text        |
| created_at     | timestamptz |

---

# deposits

Stores incoming Mobile Money payments.

| Column                | Type        |
| --------------------- | ----------- |
| id                    | uuid        |
| user_id               | uuid        |
| amount                | numeric     |
| provider              | text        |
| transaction_reference | text        |
| status                | text        |
| created_at            | timestamptz |

Statuses:

- pending
- completed
- failed

---

# withdrawals

Stores payout requests.

| Column                | Type        |
| --------------------- | ----------- |
| id                    | uuid        |
| user_id               | uuid        |
| amount                | numeric     |
| account_number        | text        |
| provider              | text        |
| transaction_reference | text        |
| status                | text        |
| created_at            | timestamptz |

Statuses:

- pending
- approved
- rejected
- failed
- completed

---

# transactions

General transaction history table.

| Column           | Type        |
| ---------------- | ----------- |
| id               | uuid        |
| user_id          | uuid        |
| amount           | numeric     |
| transaction_type | text        |
| reference        | text        |
| status           | text        |
| created_at       | timestamptz |

---

# friend_requests

Stores pending friendship requests.

| Column      | Type        |
| ----------- | ----------- |
| id          | uuid        |
| sender_id   | uuid        |
| receiver_id | uuid        |
| status      | text        |
| created_at  | timestamptz |

---

# friends

Stores accepted friendships.

| Column     | Type        |
| ---------- | ----------- |
| id         | uuid        |
| user_id    | uuid        |
| friend_id  | uuid        |
| created_at | timestamptz |

---

# games

Stores available games.

| Column     | Type        |
| ---------- | ----------- |
| id         | uuid        |
| name       | text        |
| slug       | text        |
| min_stake  | numeric     |
| max_stake  | numeric     |
| is_active  | boolean     |
| created_at | timestamptz |

Initial Games:

- Chess
- Draughts
- Tic Tac Toe
- Dice

---

# matches

Stores game sessions.

| Column       | Type        |
| ------------ | ----------- |
| id           | uuid        |
| game_id      | uuid        |
| stake_amount | numeric     |
| total_pot    | numeric     |
| winner_id    | uuid        |
| status       | text        |
| created_at   | timestamptz |

Statuses:

- waiting
- active
- completed
- cancelled

---

# match_participants

Stores users inside matches.

| Column    | Type        |
| --------- | ----------- |
| id        | uuid        |
| match_id  | uuid        |
| user_id   | uuid        |
| joined_at | timestamptz |

---

# notifications

Stores user notifications.

| Column     | Type        |
| ---------- | ----------- |
| id         | uuid        |
| user_id    | uuid        |
| title      | text        |
| message    | text        |
| is_read    | boolean     |
| created_at | timestamptz |

---

# reports

Stores user reports and abuse reports.

| Column           | Type        |
| ---------------- | ----------- |
| id               | uuid        |
| reporter_id      | uuid        |
| reported_user_id | uuid        |
| reason           | text        |
| status           | text        |
| created_at       | timestamptz |

---

# admin_logs

Stores administrative actions.

| Column     | Type        |
| ---------- | ----------- |
| id         | uuid        |
| admin_id   | uuid        |
| action     | text        |
| details    | jsonb       |
| created_at | timestamptz |

---

# settings

Stores platform configuration values.

| Column     | Type        |
| ---------- | ----------- |
| id         | uuid        |
| key        | text        |
| value      | text        |
| created_at | timestamptz |

---

# Wallet Rules

## Deposit

available_balance += deposit_amount

Create ledger entry.

---

## Match Entry

available_balance -= stake

locked_balance += stake

Create ledger entry.

---

## Match Win

locked_balance -= stake

available_balance += winnings

Create ledger entry.

---

## Match Loss

locked_balance -= stake

Create ledger entry.

---

## Withdrawal

available_balance -= withdrawal_amount

Create ledger entry.

---

# Platform Revenue

Example:

Player A = 1000 XAF

Player B = 1000 XAF

Pot = 2000 XAF

Platform Fee = 5%

Fee = 100 XAF

Winner = 1900 XAF

Revenue = 100 XAF
