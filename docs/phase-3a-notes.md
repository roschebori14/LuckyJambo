# Lucky Jambo - Phase 3A

## Wallet Core

Completed:

- Wallet Types
- Transaction Types
- Wallet Constants
- Wallet Errors
- Wallet Validation
- Balance Engine
- Wallet Service
- Ledger Service
- Wallet Balance API
- Wallet Transactions API

---

## Wallet Rules

Every user must have:

- available_balance
- locked_balance

Example:

available_balance = 5000
locked_balance = 1000

Total Balance = 6000

---

## Match Stake Flow

Before Match:

available_balance -= stake

locked_balance += stake

After Match:

Winner:

locked_balance -= stake

available_balance += winnings

Loser:

locked_balance -= stake

---

## Ledger Rule

Every wallet change must create a ledger record.

Never update balances without recording:

- amount
- transaction type
- balance before
- balance after

---

## Next Phase

Phase 3B

Features:

- Wallet Dashboard
- Balance Cards
- Transaction Table
- Wallet Summary
- Mobile Wallet UI
- Transaction Filters
