-- Lucky Jambo - Payout webhook settlement support
--
-- Fapshi's /payout response only confirms the request was *accepted*
-- (message, transId, dateInitiated - no status field). The real
-- outcome (SUCCESSFUL/FAILED) arrives later via webhook, same as
-- collections. Withdrawals now sit in 'processing' between "Fapshi
-- accepted the request" and "webhook confirmed the real outcome" -
-- add that status to the check constraint (the withdrawal.ts type
-- already expected it, the DB constraint didn't).
alter table withdrawals drop constraint withdrawals_status_check;
alter table withdrawals add constraint withdrawals_status_check
check (
    status in (
        'pending',
        'processing',
        'approved',
        'rejected',
        'failed',
        'completed'
    )
);

-- Same race migration 023 closed for deposits: the webhook and any
-- future manual status-poll fallback both do a check-then-act on
-- withdrawal status before calling apply_wallet_transaction, which
-- isn't atomic across two concurrent callers. This is the DB-level
-- backstop - a given withdrawal can only consume its locked balance
-- (match_loss) or release it (refund) once, ever. Match settlement
-- also uses these types with match ids as the reference, which live
-- in a disjoint id space from withdrawals, so this doesn't collide
-- with existing match_loss/refund rows.
create unique index if not exists idx_wallet_ledger_unique_match_loss_reference
on wallet_ledger (reference)
where type = 'match_loss' and reference is not null;

create unique index if not exists idx_wallet_ledger_unique_refund_reference
on wallet_ledger (reference)
where type = 'refund' and reference is not null;
