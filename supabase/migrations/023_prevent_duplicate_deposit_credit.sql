-- Lucky Jambo - Prevent a deposit from being credited twice
--
-- PaymentProcessor.completeDeposit() is reachable from three different
-- paths that can all race each other for the same deposit: the user's
-- own polling (/api/fapshi/verify, /api/deposits/verify) and the Fapshi
-- webhook (/api/fapshi/webhook). Each path re-checks the real status
-- with Fapshi and checks deposits.status !== 'completed' before
-- crediting, but that check-then-act is not atomic across two
-- concurrent requests - both can read "not completed yet" before
-- either has written the status update, and both then call
-- apply_wallet_transaction, crediting the wallet twice for one payment.
--
-- This closes that gap at the database level: a deposit's reference
-- can only ever appear once in wallet_ledger. If two requests race,
-- the second insert violates this constraint and its whole
-- apply_wallet_transaction call (including the balance update) rolls
-- back, since the exception aborts the function's transaction.

create unique index if not exists idx_wallet_ledger_unique_deposit_reference
on wallet_ledger (reference)
where type = 'deposit' and reference is not null;
