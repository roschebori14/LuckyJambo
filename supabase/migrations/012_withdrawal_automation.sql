-- Lucky Jambo - Withdrawal automation support
--
-- Adds what's needed to let withdrawals process automatically instead
-- of requiring an admin to manually trigger payout in the Fapshi
-- dashboard for every request:
--   - financial_trans_id: Fapshi's transId for the payout, so we can
--     reconcile and avoid double-paying if a retry happens
--   - processed_at / failure_reason: audit trail for auto-processed
--     withdrawals
--   - settings keys controlling the auto-payout threshold, so small
--     withdrawals can pay out instantly while large ones still get
--     human review (configurable - can be set arbitrarily high if
--     the platform owner wants everything automatic)

alter table withdrawals
add column if not exists financial_trans_id text,
add column if not exists processed_at timestamptz,
add column if not exists failure_reason text;

-- Prevents the same Fapshi payout transaction from ever being recorded
-- twice against two different withdrawal rows.
create unique index if not exists idx_withdrawals_financial_trans_id
on withdrawals(financial_trans_id)
where financial_trans_id is not null;

-- Deposits already have a unique constraint on provider_transaction_id
-- from 003_payment_provider_fields.sql - this is the equivalent
-- idempotency guard but enforced as a proper unique index rather than
-- relying on application-level duplicate checks alone.
create unique index if not exists idx_deposits_provider_transaction_id
on deposits(provider_transaction_id)
where provider_transaction_id is not null;

insert into settings (key, value) values
  ('auto_withdrawal_enabled', 'true'),
  ('auto_withdrawal_max_amount', '20000')
on conflict (key) do nothing;
